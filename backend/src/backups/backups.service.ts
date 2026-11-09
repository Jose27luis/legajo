import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { buffer } from 'node:stream/consumers';
import type { Readable } from 'node:stream';
import { ZipArchive } from 'archiver';
import { Queue } from 'bullmq';
import type { Response } from 'express';
import { extract } from 'tar-stream';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import { aTextoOpcional, diaSiguiente, hoyEnLima } from '../common/dates';
import { nombreTrabajador } from '../common/names';
import type { SesionActiva } from '../common/session';
import { carpetaTrabajador, nombreDescarga, slug } from '../documents/document.mapper';
import { conexionRedis } from '../documents/document-queue';
import { ENTORNO, type Entorno } from '../environment/environment';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CLAVE_RESUMEN, COLA_RESPALDOS, TRABAJO_MANUAL, type ResumenRepositorio, type TrabajoRespaldo } from './backup-queue';
import type { BackupDownloadDto, BackupPanelDto, BackupRunDto, BackupStatusDto, RepositoryDto, SnapshotDto } from './dto/backup.dto';
import { NOMBRE_VOLCADO, exigirExito, flujoRestic, variablesRestic, type FlujoRestic } from './restic';

const POR_PAGINA = 20;
const ID_MANUAL = 'backup-manual';

const formatoCarpeta = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface CopiaDescargable {
  id: string;
  inicio: Date;
  snapshotBd: string;
  snapshotArchivos: string;
}

interface ArchivoConocido {
  nombre: string;
  fila: string[];
}

const ENCABEZADO_INDICE = [
  'Nombre en el zip',
  'Ruta original',
  'DNI',
  'Trabajador',
  'Sección',
  'Tipo de documento',
  'Número',
  'Fecha de emisión',
  'Versión',
];
const CARPETA_LEGAJOS = 'legajos';
const CARPETA_SIN_REGISTRO = 'sin_registro';
const BOM_UTF8 = Buffer.from([0xef, 0xbb, 0xbf]);
const LARGO_NOMBRE = 150;
const CARACTERES_PROHIBIDOS = /[\\/:*?"<>|\p{Cc}]+/gu;

function nombreOriginal(texto: string): string | null {
  const limpio = texto
    .replace(/\.pdf$/i, '')
    .replace(CARACTERES_PROHIBIDOS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LARGO_NOMBRE)
    .replace(/[. ]+$/, '');
  return limpio === '' ? null : limpio;
}

function celdaCsv(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

function indiceCsv(filas: string[][]): Buffer {
  const lineas = [ENCABEZADO_INDICE, ...filas].map((fila) => fila.map(celdaCsv).join(';'));
  return Buffer.concat([BOM_UTF8, Buffer.from(`${lineas.join('\r\n')}\r\n`, 'utf8')]);
}

function agregarAlZip(archivador: ZipArchive, respuesta: Response, contenido: Readable | Buffer, nombre: string): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const limpiar = () => {
      archivador.off('entry', listo);
      archivador.off('error', fallo);
      respuesta.off('close', listo);
    };
    const listo = () => {
      limpiar();
      resolver();
    };
    const fallo = (error: Error) => {
      limpiar();
      rechazar(error);
    };
    archivador.once('entry', listo);
    archivador.once('error', fallo);
    respuesta.once('close', listo);
    archivador.append(contenido, { name: nombre, store: true });
  });
}

function inicioDelDia(texto: string): Date {
  return new Date(`${texto}T00:00:00.000-05:00`);
}

function nombreCarpeta(fecha: Date): string {
  const partes = Object.fromEntries(formatoCarpeta.formatToParts(fecha).map((parte) => [parte.type, parte.value]));
  return `${partes['year']}-${partes['month']}-${partes['day']}_${partes['hour']}${partes['minute']}`;
}

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
  private readonly bitacora = new Logger('Respaldos');

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

  async descargar(consulta: BackupDownloadDto, sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    if (consulta.desde > consulta.hasta) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la fecha final');
    }
    if (consulta.hasta > hoyEnLima()) {
      throw new BadRequestException('La fecha final no puede ser futura');
    }
    if (this.entorno.RESTIC_PASSWORD === undefined) {
      throw new ServiceUnavailableException('Las copias de seguridad no están configuradas en el servidor');
    }
    const copias = await this.copiasDelRango(consulta.desde, consulta.hasta);
    if (copias.length === 0) {
      throw new NotFoundException('No hay copias guardadas en ese rango de fechas');
    }
    await this.auditoria.registrar({
      accion: 'BACKUP_DESCARGAR',
      entidad: 'backup',
      usuarioId: sesion.usuarioId,
      cliente,
      detalle: { desde: consulta.desde, hasta: consulta.hasta, ejecuciones: copias.map((copia) => copia.id) },
    });

    const variables = variablesRestic(this.entorno);
    const conocidos = await this.nombresDeArchivos();
    const nombre = `copias-legajos_${consulta.desde}_al_${consulta.hasta}.zip`;
    respuesta.setHeader('Content-Type', 'application/zip');
    respuesta.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    respuesta.setHeader('X-Accel-Buffering', 'no');

    const archivador = new ZipArchive({ store: true, forceZip64: true });
    let actual: FlujoRestic | null = null;
    let cancelado = false;
    respuesta.on('close', () => {
      if (!respuesta.writableFinished) {
        cancelado = true;
        actual?.detener();
        void archivador.abort();
      }
    });
    archivador.on('error', () => respuesta.destroy());
    archivador.pipe(respuesta);
    const agregados = new Set<string>();
    const filas: string[][] = [];
    try {
      for (const copia of [...copias].reverse()) {
        const carpeta = nombreCarpeta(copia.inicio);
        if (cancelado) {
          return;
        }
        actual = flujoRestic(['dump', '--quiet', copia.snapshotBd, `/${NOMBRE_VOLCADO}`], variables);
        await agregarAlZip(archivador, respuesta, actual.salida, `${carpeta}/${NOMBRE_VOLCADO}`);
        exigirExito(await actual.terminado, `Base de datos de la copia ${carpeta}`);
        if (cancelado) {
          return;
        }
        actual = flujoRestic(['dump', '--quiet', '--archive', 'tar', copia.snapshotArchivos, this.entorno.DIR_ARCHIVOS], variables);
        filas.push(...(await this.agregarArchivos(archivador, respuesta, actual.salida, conocidos, agregados, () => cancelado)));
        exigirExito(await actual.terminado, `Archivos de la copia ${carpeta}`);
      }
      if (cancelado) {
        return;
      }
      await agregarAlZip(archivador, respuesta, indiceCsv(filas), 'indice.csv');
      await archivador.finalize();
    } catch (error: unknown) {
      this.bitacora.error(`Descarga de copias interrumpida: ${error instanceof Error ? error.message : 'error desconocido'}`);
      void archivador.abort();
      respuesta.destroy();
    }
  }

  private async copiasDelRango(desde: string, hasta: string): Promise<CopiaDescargable[]> {
    const [filas, repositorio] = await Promise.all([
      this.prisma.backupEjecucion.findMany({
        where: { estado: 'CORRECTO', inicio: { gte: inicioDelDia(desde), lt: inicioDelDia(diaSiguiente(hasta)) } },
        select: { id: true, inicio: true, snapshotBd: true, snapshotArchivos: true },
        orderBy: { inicio: 'asc' },
      }),
      this.repositorio(),
    ]);
    const guardados = new Set((repositorio?.snapshots ?? []).map((snapshot) => snapshot.id));
    return filas.flatMap(({ id, inicio, snapshotBd, snapshotArchivos }) =>
      snapshotBd !== null && snapshotArchivos !== null && guardados.has(snapshotBd) && guardados.has(snapshotArchivos)
        ? [{ id, inicio, snapshotBd, snapshotArchivos }]
        : [],
    );
  }

  private async nombresDeArchivos(): Promise<Map<string, ArchivoConocido>> {
    const archivos = await this.prisma.documentoArchivo.findMany({
      select: {
        id: true,
        ruta: true,
        version: true,
        nombreOriginal: true,
        documento: {
          select: {
            archivoActualId: true,
            numero: true,
            fechaEmision: true,
            tipoDocumento: { select: { codigo: true, nombre: true, seccion: { select: { carpeta: true } } } },
            trabajador: { select: { numeroDoc: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true } },
          },
        },
      },
      orderBy: [{ creadoEn: 'asc' }, { version: 'asc' }],
    });
    const usados = new Map<string, number>();
    const conocidos = new Map<string, ArchivoConocido>();
    for (const archivo of archivos) {
      const { documento } = archivo;
      const { tipoDocumento } = documento;
      const carpeta = [
        CARPETA_LEGAJOS,
        carpetaTrabajador(documento.trabajador),
        tipoDocumento.seccion.carpeta,
        `${tipoDocumento.codigo}_${slug(tipoDocumento.nombre, 60)}`,
      ].join('/');
      const base = nombreOriginal(archivo.nombreOriginal) ?? nombreDescarga(documento).replace(/\.pdf$/, '');
      const sufijo = archivo.id === documento.archivoActualId ? '' : ` (v${archivo.version})`;
      const propuesto = `${carpeta}/${base}${sufijo}`;
      const repeticion = (usados.get(propuesto) ?? 0) + 1;
      usados.set(propuesto, repeticion);
      const nombre = `${propuesto}${repeticion === 1 ? '' : ` (${repeticion})`}.pdf`;
      conocidos.set(archivo.ruta, {
        nombre,
        fila: [
          nombre,
          archivo.ruta,
          documento.trabajador.numeroDoc,
          nombreTrabajador(documento.trabajador),
          documento.tipoDocumento.seccion.carpeta,
          `${documento.tipoDocumento.codigo} ${documento.tipoDocumento.nombre}`,
          documento.numero ?? '',
          aTextoOpcional(documento.fechaEmision) ?? '',
          String(archivo.version),
        ],
      });
    }
    return conocidos;
  }

  private async agregarArchivos(
    archivador: ZipArchive,
    respuesta: Response,
    tar: Readable,
    conocidos: Map<string, ArchivoConocido>,
    agregados: Set<string>,
    cancelado: () => boolean,
  ): Promise<string[][]> {
    const prefijo = `${this.entorno.DIR_ARCHIVOS.replace(/^\/+/, '')}/`;
    const extractor = extract();
    tar.on('error', (error: Error) => extractor.destroy(error));
    tar.pipe(extractor);
    const filas: string[][] = [];
    for await (const entrada of extractor) {
      if (cancelado()) {
        extractor.destroy();
        break;
      }
      const ruta = entrada.header.name.startsWith(prefijo) ? entrada.header.name.slice(prefijo.length) : entrada.header.name;
      if (entrada.header.type !== 'file' || agregados.has(ruta)) {
        entrada.resume();
        continue;
      }
      agregados.add(ruta);
      const conocido = conocidos.get(ruta);
      const nombre = conocido?.nombre ?? `${CARPETA_SIN_REGISTRO}/${ruta.replace(/\/(v\d+\.pdf)$/, '_$1')}`;
      const contenido = await buffer(entrada);
      await agregarAlZip(archivador, respuesta, contenido, nombre);
      filas.push(conocido?.fila ?? [nombre, ruta, '', '', '', '', '', '', '']);
    }
    return filas;
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
