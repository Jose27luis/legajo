import { randomBytes } from 'node:crypto';
import { copyFile, rm } from 'node:fs/promises';
import { BadRequestException, HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DatosCliente } from '../common/client';
import { nombreTrabajador } from '../common/names';
import type { SesionActiva } from '../common/session';
import { ENTORNO, type Entorno } from '../environment/environment';
import { rutaSubida } from '../documents/document-queue';
import { DocumentsService, type DatosValidados } from '../documents/documents.service';
import { UploadServerService } from '../documents/upload-server.service';
import { GERENTE_MICRORED } from '../seed-catalogs';
import type { BulkDesignationDto, RegisterBulkDesignationDto } from './dto/bulk-designation-input.dto';
import type { BulkResultDto, BulkReviewDto, HeadshipCandidateDto } from './dto/headship.dto';
import { CODIGO_DESIGNACION, buscarCruce, campoAreaDe, seCruzan, type Designacion } from './headship-rules';

const TIEMPO_TRANSACCION_MS = 120000;

interface Analisis {
  revision: BulkReviewDto;
  validados: DatosValidados[];
}

@Injectable()
export class BulkDesignationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentos: DocumentsService,
    private readonly subidas: UploadServerService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async candidatos(areaId: number): Promise<HeadshipCandidateDto[]> {
    const area = await this.prisma.area.findUnique({ where: { id: areaId }, select: { tipo: true } });
    if (area === null || (area.tipo !== 'EESS' && area.tipo !== 'MICRORED')) {
      throw new NotFoundException('El EESS o la microred no existe');
    }
    const vinculos = await this.prisma.vinculo.findMany({
      where: {
        actual: true,
        trabajador: { estado: 'ACTIVO' },
        area: area.tipo === 'EESS' ? { id: areaId } : { padreId: areaId },
      },
      include: { trabajador: true, cargo: true, area: true },
    });
    return vinculos
      .map((vinculo) => ({
        trabajadorId: vinculo.trabajadorId,
        nombre: nombreTrabajador(vinculo.trabajador),
        documentoIdentidad: `${vinculo.trabajador.tipoDocIdentidad} ${vinculo.trabajador.numeroDoc}`,
        cargo: vinculo.cargo.nombre,
        eess: vinculo.area.nombre,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  async revisar(datos: BulkDesignationDto, sesion: SesionActiva): Promise<BulkReviewDto> {
    return (await this.analizar(datos, sesion)).revision;
  }

  async registrar(datos: RegisterBulkDesignationDto, sesion: SesionActiva, cliente: DatosCliente): Promise<BulkResultDto> {
    const nombreOriginal = await this.documentos.exigirSubida(datos.subidaId, sesion);
    const { revision, validados } = await this.analizar(datos, sesion);
    if (!revision.valida) {
      const detalle = revision.filas
        .filter((fila) => fila.problemas.length > 0)
        .slice(0, 5)
        .map((fila) => `Fila ${fila.indice + 1}: ${fila.problemas[0]}`)
        .join(' ');
      throw new BadRequestException(`No se registró ninguna designación. ${detalle}`);
    }
    const original = rutaSubida(this.entorno.DIR_SUBIDAS, datos.subidaId);
    const copias: string[] = [];
    let creados: string[];
    try {
      for (let indice = 0; indice < datos.asignaciones.length; indice++) {
        const subidaId = randomBytes(16).toString('hex');
        await copyFile(original, rutaSubida(this.entorno.DIR_SUBIDAS, subidaId));
        copias.push(subidaId);
      }
      creados = await this.prisma.$transaction(
        async (transaccion) => {
          const ids: string[] = [];
          for (const [indice, asignacion] of datos.asignaciones.entries()) {
            const documento = await this.documentos.crearDocumento(transaccion, {
              trabajadorId: asignacion.trabajadorId,
              validados: validados[indice],
              subidaId: copias[indice],
              nombreOriginal,
              sesion,
              cliente,
              loteItemId: null,
              vinculoId: null,
            });
            ids.push(documento.id);
          }
          return ids;
        },
        { timeout: TIEMPO_TRANSACCION_MS, maxWait: 10000 },
      );
    } catch (error: unknown) {
      await Promise.all(copias.map((subidaId) => rm(rutaSubida(this.entorno.DIR_SUBIDAS, subidaId), { force: true })));
      throw error;
    }
    for (const [indice, documentoId] of creados.entries()) {
      await this.documentos.encolar(documentoId, copias[indice], nombreOriginal, sesion.usuarioId);
    }
    await this.subidas.almacen.remove(datos.subidaId).catch(() => undefined);
    return { documentos: creados };
  }

  private async analizar(datos: BulkDesignationDto, sesion: SesionActiva): Promise<Analisis> {
    const tipo = await this.prisma.tipoDocumento.findUnique({ where: { codigo: CODIGO_DESIGNACION }, select: { id: true } });
    if (tipo === null) {
      throw new BadRequestException('La designación 0704 no está en el catálogo');
    }
    const campoArea = campoAreaDe(datos.cargo);
    const [trabajadores, areas] = await Promise.all([
      this.prisma.trabajador.findMany({
        where: { id: { in: [...new Set(datos.asignaciones.map((asignacion) => asignacion.trabajadorId))] } },
        include: { vinculos: { where: { actual: true }, include: { area: true } } },
      }),
      this.prisma.area.findMany({
        where: { id: { in: [...new Set(datos.asignaciones.map((asignacion) => asignacion.areaId))] } },
        select: { id: true, nombre: true },
      }),
    ]);
    const porId = new Map(trabajadores.map((trabajador) => [trabajador.id, trabajador]));
    const nombreArea = new Map(areas.map((area) => [area.id, area.nombre]));
    const designaciones: Designacion[] = [];
    const filas: BulkReviewDto['filas'] = [];
    const validados: DatosValidados[] = [];

    for (const [indice, asignacion] of datos.asignaciones.entries()) {
      const problemas: string[] = [];
      const desde = asignacion.desde ?? datos.desde;
      const hasta = asignacion.hasta ?? datos.hasta;
      const designacion: Designacion = { cargo: datos.cargo, campoArea, areaId: asignacion.areaId, desde, hasta };
      designaciones.push(designacion);
      const sede = nombreArea.get(asignacion.areaId) ?? 'la sede';
      const trabajador = porId.get(asignacion.trabajadorId);

      if (hasta !== null && hasta < desde) {
        problemas.push('El término de funciones es anterior al inicio.');
      }
      if (trabajador === undefined) {
        problemas.push('La persona elegida no existe.');
      } else if (trabajador.estado !== 'ACTIVO') {
        problemas.push(`${nombreTrabajador(trabajador)} está cesado.`);
      } else if (
        !trabajador.vinculos.some((vinculo) =>
          datos.cargo === GERENTE_MICRORED ? vinculo.area.padreId === asignacion.areaId : vinculo.areaId === asignacion.areaId,
        )
      ) {
        problemas.push(
          datos.cargo === GERENTE_MICRORED
            ? `${nombreTrabajador(trabajador)} no trabaja en ningún EESS de ${sede}.`
            : `${nombreTrabajador(trabajador)} no tiene su período actual en ${sede}.`,
        );
      }

      for (let anterior = 0; anterior < indice; anterior++) {
        const otra = datos.asignaciones[anterior];
        if (otra.trabajadorId === asignacion.trabajadorId) {
          problemas.push(`La misma persona ya está en la fila ${anterior + 1}.`);
        } else if (otra.areaId === asignacion.areaId && seCruzan(designaciones[anterior], designacion)) {
          problemas.push(`${sede} ya tiene a otra persona en la fila ${anterior + 1} en fechas que se cruzan.`);
        }
      }

      try {
        validados.push(
          await this.documentos.validar(
            {
              tipoDocumentoId: tipo.id,
              numero: datos.numero,
              fechaEmision: datos.fechaEmision,
              fechaVencimiento: null,
              emisor: null,
              observaciones: datos.observaciones,
              ubicacionFisica: null,
              nivelAcceso: datos.nivelAcceso,
              datos: {
                tipoAccion: datos.tipoAccion,
                cargoAsignado: datos.cargo,
                [campoArea]: asignacion.areaId,
                fechaInicioFunciones: desde,
                fechaFinFunciones: hasta,
              },
            },
            sesion,
            null,
          ),
        );
      } catch (error: unknown) {
        if (!(error instanceof HttpException)) {
          throw error;
        }
        problemas.push(error.message);
      }

      const cruce = await buscarCruce(this.prisma, designacion, asignacion.trabajadorId, null);
      if (cruce !== null) {
        problemas.push(cruce);
      }
      filas.push({ indice, problemas });
    }
    return { revision: { filas, valida: filas.every((fila) => fila.problemas.length === 0) }, validados };
  }
}
