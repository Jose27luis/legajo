import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import { ENTORNO, type Entorno } from '../environment/environment';
import { PrismaService } from '../prisma/prisma.service';
import {
  COLA_DOCUMENTOS,
  FORMATO_SUBIDA,
  TRABAJO_LIMPIAR,
  TRABAJO_PROCESAR,
  conexionRedis,
  rutaSubida,
  type TrabajoProcesar,
} from './document-queue';
import { argumentosGhostscript, ejecutar, hashArchivo } from './pdf-tools';
import { bloquearLote, recalcularLote } from '../batches/batch-counters';

const UMBRAL_OPTIMIZACION = 0.95;
const VIGENCIA_SUBIDA_MS = 24 * 60 * 60 * 1000;
const PREFIJO_COLAS = 'legajos-colas';

class FalloDefinitivo extends Error {}

@Injectable()
export class DocumentProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly bitacora = new Logger('Procesador');
  private trabajador: Worker<TrabajoProcesar> | null = null;
  private programador: Queue | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async onModuleInit(): Promise<void> {
    const conexion = conexionRedis(this.entorno.REDIS_URL);
    this.programador = new Queue(COLA_DOCUMENTOS, { connection: conexion, prefix: PREFIJO_COLAS });
    await this.programador.upsertJobScheduler(TRABAJO_LIMPIAR, { every: 60 * 60 * 1000 }, { name: TRABAJO_LIMPIAR });
    this.trabajador = new Worker<TrabajoProcesar>(
      COLA_DOCUMENTOS,
      async (trabajo: Job<TrabajoProcesar>) => {
        if (trabajo.name === TRABAJO_LIMPIAR) {
          await this.limpiarSubidas();
          return;
        }
        await this.procesar(trabajo.data);
      },
      { connection: conexion, prefix: PREFIJO_COLAS, concurrency: this.entorno.WORKER_CONCURRENCIA },
    );
    this.trabajador.on('failed', (trabajo, error) => {
      if (trabajo === undefined || trabajo.name !== TRABAJO_PROCESAR) {
        return;
      }
      const intentos = trabajo.opts.attempts ?? 1;
      this.bitacora.warn(`Documento ${trabajo.data.documentoId}: intento ${trabajo.attemptsMade} de ${intentos} falló`);
      if (trabajo.attemptsMade >= intentos) {
        void this.marcarFallo(trabajo.data, 'No se pudo procesar el PDF. Puedes reintentar.', false, error.message);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.trabajador?.close();
    await this.programador?.close();
  }

  private async procesar(datos: TrabajoProcesar): Promise<void> {
    const documento = await this.prisma.documento.findUnique({
      where: { id: datos.documentoId },
      include: { tipoDocumento: { select: { nombre: true, codigo: true } } },
    });
    if (documento === null || documento.estado === 'ANULADO' || documento.subidaPendiente !== datos.subidaId) {
      await this.borrarSubida(datos.subidaId);
      return;
    }
    const original = rutaSubida(this.entorno.DIR_SUBIDAS, datos.subidaId);
    const trabajo = `${original}.trabajo`;
    try {
      await rm(trabajo, { recursive: true, force: true });
      await mkdir(trabajo, { recursive: true });

      const tamanoOriginal = (await stat(original)).size;
      const hashOriginal = await hashArchivo(original);
      const duplicado = await this.prisma.documentoArchivo.findFirst({
        where: {
          hashOriginal,
          documento: { trabajadorId: documento.trabajadorId, estado: { not: 'ANULADO' }, id: { not: documento.id } },
        },
        include: { documento: { include: { tipoDocumento: { select: { codigo: true, nombre: true } } } } },
      });
      if (duplicado !== null) {
        throw new FalloDefinitivo(
          `Este PDF ya está en el legajo como ${duplicado.documento.tipoDocumento.codigo} ${duplicado.documento.tipoDocumento.nombre}`,
        );
      }

      const revision = await ejecutar('qpdf', ['--check', original]);
      if (revision.codigo === 2) {
        throw new FalloDefinitivo('El PDF está dañado y no se puede abrir');
      }

      let fuente = original;
      const clave = await ejecutar('qpdf', ['--requires-password', original]);
      if (clave.codigo === 0) {
        throw new FalloDefinitivo('El PDF está protegido con contraseña. Quita la contraseña y súbelo de nuevo.');
      }
      if (clave.codigo === 3) {
        const descifrado = `${trabajo}/descifrado.pdf`;
        const resultado = await ejecutar('qpdf', ['--decrypt', original, descifrado]);
        if (resultado.codigo !== 0 && resultado.codigo !== 3) {
          throw new FalloDefinitivo('No se pudieron quitar las restricciones del PDF');
        }
        fuente = descifrado;
      }

      const optimizado = `${trabajo}/optimizado.pdf`;
      const ghostscript = await ejecutar(
        'gs',
        argumentosGhostscript(fuente, optimizado, this.entorno.OPTIMIZAR_PPP, this.entorno.OPTIMIZAR_GRISES),
      );
      if (ghostscript.codigo !== 0) {
        throw new Error(`Ghostscript terminó con código ${ghostscript.codigo}`);
      }
      const tamanoOptimizado = (await stat(optimizado)).size;
      const usarOptimizado = tamanoOptimizado > 0 && tamanoOptimizado < (await stat(fuente)).size * UMBRAL_OPTIMIZACION;

      const final = `${trabajo}/final.pdf`;
      const linealizado = await ejecutar('qpdf', [
        '--linearize',
        '--object-streams=generate',
        usarOptimizado ? optimizado : fuente,
        final,
      ]);
      if (linealizado.codigo !== 0 && linealizado.codigo !== 3) {
        throw new Error(`qpdf terminó con código ${linealizado.codigo}`);
      }
      const paginas = Number((await ejecutar('qpdf', ['--show-npages', final])).salida.trim());
      if (!Number.isInteger(paginas) || paginas < 1) {
        throw new FalloDefinitivo('El PDF no tiene páginas legibles');
      }
      const tamanoFinal = (await stat(final)).size;
      const hashFinal = await hashArchivo(final);

      const anterior = await this.prisma.documentoArchivo.aggregate({
        where: { documentoId: documento.id },
        _max: { version: true },
      });
      const version = (anterior._max.version ?? 0) + 1;
      const relativa = `${documento.trabajadorId}/${documento.id}/v${version}.pdf`;
      const destino = `${this.entorno.DIR_ARCHIVOS}/${relativa}`;
      await mkdir(`${this.entorno.DIR_ARCHIVOS}/${documento.trabajadorId}/${documento.id}`, { recursive: true });
      await copyFile(final, `${destino}.tmp`);
      await rename(`${destino}.tmp`, destino);

      await this.prisma.$transaction(async (transaccion) => {
        const vigente = await transaccion.documento.findUnique({ where: { id: documento.id }, select: { estado: true, subidaPendiente: true } });
        if (vigente === null || vigente.estado === 'ANULADO' || vigente.subidaPendiente !== datos.subidaId) {
          return;
        }
        const archivo = await transaccion.documentoArchivo.create({
          data: {
            documentoId: documento.id,
            version,
            ruta: relativa,
            nombreOriginal: datos.nombreOriginal.slice(0, 200),
            tamanoOriginal: BigInt(tamanoOriginal),
            tamanoFinal: BigInt(tamanoFinal),
            hashOriginal,
            hashFinal,
            paginas,
            optimizado: usarOptimizado,
            subidoPorId: datos.usuarioId,
          },
        });
        await transaccion.documento.update({
          where: { id: documento.id },
          data: { archivoActualId: archivo.id, estado: 'DISPONIBLE', detalleError: null, subidaPendiente: null },
        });
      });
      await this.borrarSubida(datos.subidaId);
      this.bitacora.log(`Documento ${documento.id} disponible (v${version}, ${paginas} folios)`);
    } catch (error: unknown) {
      if (error instanceof FalloDefinitivo) {
        await this.marcarFallo(datos, error.message, true, error.message);
        return;
      }
      throw error;
    } finally {
      await rm(trabajo, { recursive: true, force: true });
    }
  }

  private async marcarFallo(datos: TrabajoProcesar, mensaje: string, definitivo: boolean, tecnico: string): Promise<void> {
    this.bitacora.warn(`Documento ${datos.documentoId}: ${tecnico}`);
    const documento = await this.prisma.documento.findUnique({
      where: { id: datos.documentoId },
      select: { estado: true, archivoActualId: true, subidaPendiente: true },
    });
    if (documento === null || documento.estado === 'ANULADO' || documento.subidaPendiente !== datos.subidaId) {
      return;
    }
    const conVersionPrevia = documento.archivoActualId !== null;
    await this.prisma.documento.update({
      where: { id: datos.documentoId },
      data: {
        estado: conVersionPrevia ? 'DISPONIBLE' : 'ERROR',
        detalleError: (conVersionPrevia ? `No se aplicó el reemplazo: ${mensaje}` : mensaje).slice(0, 300),
        subidaPendiente: definitivo ? null : datos.subidaId,
      },
    });
    if (definitivo) {
      await this.borrarSubida(datos.subidaId);
    }
  }

  private async borrarSubida(subidaId: string): Promise<void> {
    const base = rutaSubida(this.entorno.DIR_SUBIDAS, subidaId);
    await Promise.all([
      rm(base, { force: true }),
      rm(`${base}.json`, { force: true }),
      rm(`${base}.trabajo`, { recursive: true, force: true }),
    ]);
  }

  private async limpiarSubidas(): Promise<void> {
    const limite = Date.now() - VIGENCIA_SUBIDA_MS;
    await this.cerrarSubidasIncompletas(new Date(limite));
    const [documentos, items] = await Promise.all([
      this.prisma.documento.findMany({ where: { subidaPendiente: { not: null } }, select: { subidaPendiente: true } }),
      this.prisma.loteItem.findMany({ where: { estado: 'PENDIENTE', subidaId: { not: null } }, select: { subidaId: true } }),
    ]);
    const pendientes = new Set([
      ...documentos.map((documento) => documento.subidaPendiente),
      ...items.map((item) => item.subidaId),
    ]);
    let borradas = 0;
    for (const nombre of await readdir(this.entorno.DIR_SUBIDAS)) {
      const id = nombre.split('.')[0];
      if (!FORMATO_SUBIDA.test(id) || pendientes.has(id)) {
        continue;
      }
      const datos = await stat(`${this.entorno.DIR_SUBIDAS}/${nombre}`).catch(() => null);
      if (datos !== null && datos.mtimeMs < limite) {
        await this.borrarSubida(id);
        borradas += 1;
      }
    }
    if (borradas > 0) {
      this.bitacora.log(`Subidas abandonadas eliminadas: ${borradas}`);
    }
  }

  private async cerrarSubidasIncompletas(limite: Date): Promise<void> {
    const lotes = await this.prisma.loteItem.findMany({
      where: { estado: 'SUBIENDO', creadoEn: { lt: limite } },
      distinct: ['loteId'],
      select: { loteId: true },
    });
    for (const { loteId } of lotes) {
      await this.prisma.$transaction(async (transaccion) => {
        await bloquearLote(transaccion, loteId);
        await transaccion.loteItem.updateMany({
          where: { loteId, estado: 'SUBIENDO', creadoEn: { lt: limite } },
          data: { estado: 'ERROR', motivo: 'Subida incompleta: el archivo no terminó de subirse en 24 horas' },
        });
        await recalcularLote(transaccion, loteId);
      });
    }
    if (lotes.length > 0) {
      this.bitacora.log(`Lotes con subidas incompletas cerradas: ${lotes.length}`);
    }
  }
}
