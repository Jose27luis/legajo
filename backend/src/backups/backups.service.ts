import { ConflictException, Inject, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { conexionRedis } from '../documents/document-queue';
import { ENTORNO, type Entorno } from '../environment/environment';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CLAVE_RESUMEN, COLA_RESPALDOS, TRABAJO_MANUAL, type ResumenRepositorio, type TrabajoRespaldo } from './backup-queue';
import type { BackupPanelDto, BackupRunDto, BackupStatusDto, RepositoryDto, SnapshotDto } from './dto/backup.dto';

const POR_PAGINA = 20;
const ID_MANUAL = 'backup-manual';

const SELECCION = {
  id: true,
  origen: true,
  inicio: true,
  fin: true,
  estado: true,
  snapshotBd: true,
  snapshotArchivos: true,
  bytesAgregados: true,
  verificado: true,
  error: true,
  usuario: { select: { nombreCompleto: true } },
} satisfies Prisma.BackupEjecucionSelect;

type FilaEjecucion = Prisma.BackupEjecucionGetPayload<{ select: typeof SELECCION }>;

function aEjecucionDto(fila: FilaEjecucion): BackupRunDto {
  return {
    id: fila.id,
    origen: fila.origen,
    usuario: fila.usuario?.nombreCompleto ?? null,
    inicio: fila.inicio.toISOString(),
    fin: fila.fin?.toISOString() ?? null,
    estado: fila.estado,
    snapshotBd: fila.snapshotBd,
    snapshotArchivos: fila.snapshotArchivos,
    bytesAgregados: fila.bytesAgregados === null ? null : Number(fila.bytesAgregados),
    verificado: fila.verificado,
    error: fila.error,
  };
}

function aSnapshotDto(snapshot: ResumenRepositorio['snapshots'][number]): SnapshotDto {
  const ejecucion = snapshot.etiquetas.find((etiqueta) => etiqueta.startsWith('ejecucion-'));
  return {
    id: snapshot.id,
    fecha: snapshot.fecha,
    contenido: snapshot.etiquetas.includes('bd') ? 'bd' : snapshot.etiquetas.includes('archivos') ? 'archivos' : 'otro',
    ejecucionId: ejecucion === undefined ? null : ejecucion.slice('ejecucion-'.length),
  };
}

function esResumen(valor: unknown): valor is ResumenRepositorio {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'actualizado' in valor &&
    'espacio' in valor &&
    'snapshots' in valor &&
    Array.isArray(valor.snapshots)
  );
}

@Injectable()
export class BackupsService implements OnModuleDestroy {
  private readonly cola: Queue<TrabajoRespaldo>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditoria: AuditService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {
    this.cola = new Queue<TrabajoRespaldo>(COLA_RESPALDOS, { connection: conexionRedis(entorno.REDIS_URL), prefix: 'legajos-colas' });
  }

  async onModuleDestroy(): Promise<void> {
    await this.cola.close();
  }

  async estado(): Promise<BackupStatusDto> {
    const [ultima, ultimaCorrecta, pendiente] = await Promise.all([
      this.prisma.backupEjecucion.findFirst({ select: SELECCION, orderBy: { inicio: 'desc' } }),
      this.prisma.backupEjecucion.findFirst({ select: SELECCION, where: { estado: 'CORRECTO' }, orderBy: { inicio: 'desc' } }),
      this.pendiente(),
    ]);
    return {
      configurado: this.entorno.RESTIC_PASSWORD !== undefined,
      pendiente,
      ultima: ultima === null ? null : aEjecucionDto(ultima),
      ultimaCorrecta: ultimaCorrecta === null ? null : aEjecucionDto(ultimaCorrecta),
    };
  }

  async panel(pagina: number): Promise<BackupPanelDto> {
    const [estado, filas, total, repositorio] = await Promise.all([
      this.estado(),
      this.prisma.backupEjecucion.findMany({
        select: SELECCION,
        orderBy: { inicio: 'desc' },
        take: POR_PAGINA,
        skip: (pagina - 1) * POR_PAGINA,
      }),
      this.prisma.backupEjecucion.count(),
      this.repositorio(),
    ]);
    return { ...estado, repositorio, historial: filas.map(aEjecucionDto), total, pagina, porPagina: POR_PAGINA };
  }

  async lanzar(sesion: SesionActiva, cliente: DatosCliente): Promise<BackupStatusDto> {
    if (this.entorno.RESTIC_PASSWORD === undefined) {
      throw new ServiceUnavailableException('Las copias de seguridad no están configuradas en el servidor');
    }
    if (await this.pendiente()) {
      throw new ConflictException('Ya hay una copia en curso o esperando turno');
    }
    await this.auditoria.registrar({
      accion: 'BACKUP_MANUAL',
      entidad: 'backup',
      usuarioId: sesion.usuarioId,
      cliente,
    });
    await this.cola.add(
      TRABAJO_MANUAL,
      { usuarioId: sesion.usuarioId },
      { jobId: ID_MANUAL, removeOnComplete: true, removeOnFail: true },
    );
    return this.estado();
  }

  private async pendiente(): Promise<boolean> {
    const [enCurso, enCola] = await Promise.all([
      this.prisma.backupEjecucion.count({ where: { estado: 'EN_CURSO' } }),
      this.cola.getJobCounts('waiting', 'active', 'prioritized'),
    ]);
    return enCurso > 0 || Object.values(enCola).some((cantidad) => cantidad > 0);
  }

  private async repositorio(): Promise<RepositoryDto | null> {
    const texto = await this.redis.cliente.get(CLAVE_RESUMEN);
    if (texto === null) {
      return null;
    }
    const datos: unknown = JSON.parse(texto);
    if (!esResumen(datos)) {
      return null;
    }
    return { actualizado: datos.actualizado, espacio: datos.espacio, snapshots: datos.snapshots.map(aSnapshotDto) };
  }
}
