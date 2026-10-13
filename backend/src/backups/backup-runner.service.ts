import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { conexionRedis } from '../documents/document-queue';
import { ENTORNO, type Entorno } from '../environment/environment';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CLAVE_RESUMEN,
  COLA_RESPALDOS,
  TRABAJO_MANUAL,
  TRABAJO_PROGRAMADO,
  type ResumenRepositorio,
  type TrabajoRespaldo,
} from './backup-queue';
import {
  CODIGO_SIN_REPOSITORIO,
  ejecutarRestic,
  exigirExito,
  leerEspacio,
  leerResumenCopia,
  leerSnapshots,
  variablesBaseDeDatos,
} from './restic';

const PREFIJO_COLAS = 'legajos-colas';
const HOST_RESTIC = 'legajos';
const NOMBRE_VOLCADO = 'legajos.dump';
const MUESTRA_VERIFICACION = '5%';

const diaEnLima = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', weekday: 'short' });

@Injectable()
export class BackupRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly bitacora = new Logger('Respaldos');
  private trabajador: Worker<TrabajoRespaldo> | null = null;
  private programador: Queue<TrabajoRespaldo> | null = null;
  private redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cerrarInterrumpidas();
    const conexion = conexionRedis(this.entorno.REDIS_URL);
    this.redis = new Redis(this.entorno.REDIS_URL, { keyPrefix: 'legajos:', maxRetriesPerRequest: 3 });
    this.programador = new Queue<TrabajoRespaldo>(COLA_RESPALDOS, { connection: conexion, prefix: PREFIJO_COLAS });
    await this.programador.upsertJobScheduler(
      TRABAJO_PROGRAMADO,
      { pattern: this.entorno.RESPALDO_CRON, tz: 'America/Lima' },
      { name: TRABAJO_PROGRAMADO, data: { usuarioId: null }, opts: { removeOnComplete: 50, removeOnFail: 50 } },
    );
    this.trabajador = new Worker<TrabajoRespaldo>(COLA_RESPALDOS, (trabajo: Job<TrabajoRespaldo>) => this.respaldar(trabajo), {
      connection: conexion,
      prefix: PREFIJO_COLAS,
      concurrency: 1,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.trabajador?.close();
    await this.programador?.close();
    await this.redis?.quit();
  }

  private async cerrarInterrumpidas(): Promise<void> {
    await this.prisma.backupEjecucion.updateMany({
      where: { estado: 'EN_CURSO' },
      data: { estado: 'ERROR', fin: new Date(), error: 'La copia se interrumpió porque el worker se reinició' },
    });
  }

  private async respaldar(trabajo: Job<TrabajoRespaldo>): Promise<void> {
    const manual = trabajo.name === TRABAJO_MANUAL && trabajo.data.usuarioId !== null;
    let ejecucionId: string;
    try {
      const ejecucion = await this.prisma.backupEjecucion.create({
        data: { origen: manual ? 'MANUAL' : 'PROGRAMADO', usuarioId: manual ? trabajo.data.usuarioId : null },
        select: { id: true },
      });
      ejecucionId = ejecucion.id;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.bitacora.warn('Ya hay una copia en curso; se omite esta');
        return;
      }
      throw error;
    }

    try {
      const variables = this.variables();
      await this.asegurarRepositorio(variables);
      const etiqueta = `ejecucion-${ejecucionId}`;
      const base = leerResumenCopia(
        exigirExito(
          await ejecutarRestic(
            [
              'backup',
              '--json',
              '--quiet',
              '--host',
              HOST_RESTIC,
              '--tag',
              `bd,${etiqueta}`,
              '--stdin-filename',
              NOMBRE_VOLCADO,
              '--stdin-from-command',
              '--',
              'pg_dump',
              '--format=custom',
              '--no-owner',
              '--no-privileges',
            ],
            variables,
          ),
          'Copia de la base de datos',
        ).salida,
      );
      const archivos = leerResumenCopia(
        exigirExito(
          await ejecutarRestic(
            [
              'backup',
              '--json',
              '--quiet',
              '--host',
              HOST_RESTIC,
              '--tag',
              `archivos,${etiqueta}`,
              '--exclude',
              '.anterior-*',
              '--exclude',
              '.restaurado-*',
              this.entorno.DIR_ARCHIVOS,
            ],
            variables,
          ),
          'Copia de los archivos',
        ).salida,
      );
      exigirExito(
        await ejecutarRestic(
          ['forget', '--prune', '--quiet', '--group-by', 'host,paths', '--keep-daily', '7', '--keep-weekly', '4', '--keep-monthly', '12'],
          variables,
        ),
        'Depuración de copias antiguas',
      );
      let verificado: boolean | null = null;
      if (diaEnLima.format(new Date()) === 'Sun') {
        exigirExito(await ejecutarRestic(['check', `--read-data-subset=${MUESTRA_VERIFICACION}`], variables), 'Verificación del repositorio');
        verificado = true;
      }
      await this.prisma.$transaction(async (transaccion) => {
        await transaccion.backupEjecucion.update({
          where: { id: ejecucionId },
          data: {
            estado: 'CORRECTO',
            fin: new Date(),
            snapshotBd: base.snapshotId,
            snapshotArchivos: archivos.snapshotId,
            bytesAgregados: BigInt(base.bytesAgregados + archivos.bytesAgregados),
            verificado,
          },
        });
        await transaccion.auditoria.create({
          data: {
            accion: 'BACKUP_CORRECTO',
            entidad: 'backup',
            entidadId: ejecucionId,
            usuarioId: manual ? trabajo.data.usuarioId : null,
            detalle: { snapshotBd: base.snapshotId, snapshotArchivos: archivos.snapshotId, verificado },
          },
        });
      });
      this.bitacora.log(`Copia ${ejecucionId} terminada`);
      await this.guardarResumen(variables).catch((error: unknown) => {
        this.bitacora.warn(`No se pudo leer el estado del repositorio: ${error instanceof Error ? error.message : 'error desconocido'}`);
      });
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      this.bitacora.error(`Copia ${ejecucionId} con error: ${mensaje}`);
      await this.prisma.$transaction(async (transaccion) => {
        await transaccion.backupEjecucion.update({
          where: { id: ejecucionId },
          data: { estado: 'ERROR', fin: new Date(), error: mensaje.slice(0, 2000) },
        });
        await transaccion.auditoria.create({
          data: {
            accion: 'BACKUP_ERROR',
            entidad: 'backup',
            entidadId: ejecucionId,
            usuarioId: manual ? trabajo.data.usuarioId : null,
            detalle: { error: mensaje.slice(0, 500) },
          },
        });
      });
    }
  }

  private variables(): Record<string, string> {
    if (this.entorno.RESTIC_PASSWORD === undefined) {
      throw new Error('Falta configurar la clave de las copias (RESTIC_PASSWORD) en el servidor');
    }
    return {
      RESTIC_REPOSITORY: this.entorno.RESTIC_REPOSITORY,
      RESTIC_PASSWORD: this.entorno.RESTIC_PASSWORD,
      ...variablesBaseDeDatos(this.entorno.DATABASE_URL),
    };
  }

  private async asegurarRepositorio(variables: Record<string, string>): Promise<void> {
    const configuracion = await ejecutarRestic(['cat', 'config', '--quiet'], variables);
    if (configuracion.codigo === CODIGO_SIN_REPOSITORIO) {
      exigirExito(await ejecutarRestic(['init', '--quiet'], variables), 'Creación del repositorio');
      return;
    }
    exigirExito(configuracion, 'Apertura del repositorio');
  }

  private async guardarResumen(variables: Record<string, string>): Promise<void> {
    const espacio = exigirExito(await ejecutarRestic(['stats', '--json', '--quiet', '--mode', 'raw-data'], variables), 'Espacio usado');
    const snapshots = exigirExito(await ejecutarRestic(['snapshots', '--json', '--quiet'], variables), 'Lista de copias');
    const resumen: ResumenRepositorio = {
      actualizado: new Date().toISOString(),
      espacio: leerEspacio(espacio.salida),
      snapshots: leerSnapshots(snapshots.salida).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    };
    await this.redis?.set(CLAVE_RESUMEN, JSON.stringify(resumen));
  }
}
