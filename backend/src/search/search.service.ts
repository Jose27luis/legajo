import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { DatosCliente } from '../common/client';
import { aTextoDeFila, normalizarBusqueda } from '../common/dates';
import { nombreTrabajador } from '../common/names';
import type { SesionActiva } from '../common/session';
import { DocumentsService } from '../documents/documents.service';
import { aDocumentoDto, filtroVisibilidad, incluirDocumento } from '../documents/document.mapper';
import { aListadoDto, incluirListado } from '../workers/worker.mapper';
import type { SearchQueryDto } from './dto/search-query.dto';
import type { QuickDocumentDto, QuickResultDto, QuickWorkerDto, SearchDocumentDto, SearchResultDto, SearchWorkerDto } from './dto/search.dto';
import {
  VINCULO_ACTUAL,
  filtrosDocumento,
  filtrosTrabajador,
  ordenDocumento,
  ordenTrabajador,
  textoDocumento,
  textoTrabajador,
  unir,
  visibilidadSql,
  type CatalogosCoincidentes,
} from './search-queries';
import { interpretarTexto, type TextoBusqueda } from './search-text';

const POR_PAGINA = 25;
const RAPIDA_TRABAJADORES = 6;
const RAPIDA_DOCUMENTOS = 4;
const SIN_COINCIDENCIAS: CatalogosCoincidentes = { areas: [], cargos: [], tipos: [] };

interface FilaId {
  id: string;
}

interface FilaTotal {
  total: number;
}

interface FilaTrabajadorRapido {
  id: string;
  numero_doc: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  estado: 'ACTIVO' | 'CESADO';
  cargo: string | null;
  area: string | null;
}

interface FilaDocumentoRapido {
  id: string;
  trabajador_id: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  seccion: number;
  tipo: string;
  numero: string | null;
  fecha_emision: Date | string | null;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentos: DocumentsService,
  ) {}

  async rapida(entrada: string, sesion: SesionActiva): Promise<QuickResultDto> {
    const texto = interpretarTexto(entrada);
    if (texto === null) {
      return { trabajadores: [], documentos: [] };
    }
    const catalogos = await this.coincidencias(texto);
    const trabajadores = await this.prisma.$queryRaw<FilaTrabajadorRapido[]>(Prisma.sql`
      SELECT t.id, t.numero_doc, t.nombres, t.apellido_paterno, t.apellido_materno, t.estado,
             c.nombre AS cargo, a.nombre AS area
      FROM trabajador t
      ${VINCULO_ACTUAL}
      LEFT JOIN cargo c ON c.id = vi.cargo_id
      LEFT JOIN area a ON a.id = vi.area_id
      WHERE ${textoTrabajador(texto, catalogos)}
      ORDER BY ${ordenTrabajador(texto)}
      LIMIT ${RAPIDA_TRABAJADORES}`);

    const documentos = sesion.permisos.includes('documentos.ver')
      ? await this.prisma.$queryRaw<FilaDocumentoRapido[]>(Prisma.sql`
          SELECT d.id, d.trabajador_id, d.numero, d.fecha_emision,
                 t.nombres, t.apellido_paterno, t.apellido_materno,
                 s.numero AS seccion, td.nombre AS tipo
          FROM documento d
          JOIN tipo_documento td ON td.id = d.tipo_documento_id
          JOIN seccion s ON s.id = td.seccion_id
          JOIN trabajador t ON t.id = d.trabajador_id
          WHERE ${visibilidadSql(sesion)} AND d.estado = 'DISPONIBLE' AND ${textoDocumento(texto, catalogos)}
          ORDER BY ${ordenDocumento(texto)}
          LIMIT ${RAPIDA_DOCUMENTOS}`)
      : [];

    return {
      trabajadores: trabajadores.map((fila): QuickWorkerDto => ({
        id: fila.id,
        numeroDoc: fila.numero_doc,
        nombre: nombreTrabajador({ nombres: fila.nombres, apellidoPaterno: fila.apellido_paterno, apellidoMaterno: fila.apellido_materno }),
        cargo: fila.cargo,
        area: fila.area,
        estado: fila.estado,
      })),
      documentos: documentos.map((fila): QuickDocumentDto => ({
        id: fila.id,
        trabajadorId: fila.trabajador_id,
        trabajador: nombreTrabajador({ nombres: fila.nombres, apellidoPaterno: fila.apellido_paterno, apellidoMaterno: fila.apellido_materno }),
        seccion: fila.seccion,
        tipo: fila.tipo,
        numero: fila.numero,
        fechaEmision: aTextoDeFila(fila.fecha_emision),
      })),
    };
  }

  async avanzada(consulta: SearchQueryDto, sesion: SesionActiva): Promise<SearchResultDto> {
    const texto = interpretarTexto(consulta.texto);
    const pagina = consulta.pagina ?? 1;
    const salto = (pagina - 1) * POR_PAGINA;
    const catalogos = await this.coincidencias(texto);
    const [trabajadores, documentos] = await Promise.all([
      this.buscarTrabajadores(consulta, sesion, texto, catalogos, salto),
      sesion.permisos.includes('documentos.ver')
        ? this.buscarDocumentos(consulta, sesion, texto, catalogos, salto)
        : Promise.resolve({ items: [], total: 0 }),
    ]);
    return { clase: texto?.clase ?? null, pagina, porPagina: POR_PAGINA, trabajadores, documentos };
  }

  async zip(ids: string[], sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    if (!sesion.permisos.includes('documentos.descargar')) {
      throw new ForbiddenException('No tienes permiso para descargar documentos');
    }
    await this.documentos.zipSeleccion(ids, sesion, cliente, respuesta);
  }

  private async buscarTrabajadores(
    consulta: SearchQueryDto,
    sesion: SesionActiva,
    texto: TextoBusqueda | null,
    catalogos: CatalogosCoincidentes,
    salto: number,
  ): Promise<{ items: SearchWorkerDto[]; total: number }> {
    const condiciones = filtrosTrabajador(consulta);
    if (texto !== null) {
      condiciones.push(textoTrabajador(texto, catalogos));
    }
    const donde = unir(condiciones);
    const [conteo, filas] = await Promise.all([
      this.prisma.$queryRaw<FilaTotal[]>(Prisma.sql`
        SELECT count(*)::int AS total FROM trabajador t ${VINCULO_ACTUAL} WHERE ${donde}`),
      this.prisma.$queryRaw<FilaId[]>(Prisma.sql`
        SELECT t.id FROM trabajador t ${VINCULO_ACTUAL} WHERE ${donde}
        ORDER BY ${ordenTrabajador(texto)}
        LIMIT ${POR_PAGINA} OFFSET ${salto}`),
    ]);
    const total = conteo[0]?.total ?? 0;
    const ids = filas.map((fila) => fila.id);
    if (ids.length === 0) {
      return { items: [], total };
    }
    const [trabajadores, conteos] = await Promise.all([
      this.prisma.trabajador.findMany({ where: { id: { in: ids } }, include: incluirListado }),
      sesion.permisos.includes('documentos.ver')
        ? this.prisma.documento.groupBy({
            by: ['trabajadorId'],
            where: { trabajadorId: { in: ids }, estado: 'DISPONIBLE', ...filtroVisibilidad(sesion) },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);
    const porId = new Map(trabajadores.map((trabajador) => [trabajador.id, trabajador]));
    const documentos = new Map(conteos.map((fila) => [fila.trabajadorId, fila._count._all]));
    const items = ids
      .map((id) => porId.get(id))
      .filter((trabajador): trabajador is NonNullable<typeof trabajador> => trabajador !== undefined)
      .map((trabajador) => ({ trabajador: aListadoDto(trabajador), documentos: documentos.get(trabajador.id) ?? 0 }));
    return { items, total };
  }

  private async buscarDocumentos(
    consulta: SearchQueryDto,
    sesion: SesionActiva,
    texto: TextoBusqueda | null,
    catalogos: CatalogosCoincidentes,
    salto: number,
  ): Promise<{ items: SearchDocumentDto[]; total: number }> {
    const condiciones = [...filtrosDocumento(consulta, sesion), ...filtrosTrabajador(consulta)];
    if (texto !== null) {
      condiciones.push(textoDocumento(texto, catalogos));
    }
    const donde = unir(condiciones);
    const desde = Prisma.sql`
      FROM documento d
      JOIN tipo_documento td ON td.id = d.tipo_documento_id
      JOIN seccion s ON s.id = td.seccion_id
      JOIN trabajador t ON t.id = d.trabajador_id
      ${VINCULO_ACTUAL}
      WHERE ${donde}`;
    const [conteo, filas] = await Promise.all([
      this.prisma.$queryRaw<FilaTotal[]>(Prisma.sql`SELECT count(*)::int AS total ${desde}`),
      this.prisma.$queryRaw<FilaId[]>(Prisma.sql`
        SELECT d.id ${desde}
        ORDER BY ${ordenDocumento(texto)}
        LIMIT ${POR_PAGINA} OFFSET ${salto}`),
    ]);
    const total = conteo[0]?.total ?? 0;
    const ids = filas.map((fila) => fila.id);
    if (ids.length === 0) {
      return { items: [], total };
    }
    const documentos = await this.prisma.documento.findMany({
      where: { id: { in: ids } },
      include: {
        ...incluirDocumento,
        trabajador: { select: { id: true, numeroDoc: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true } },
      },
    });
    const porId = new Map(documentos.map((documento) => [documento.id, documento]));
    const items = ids
      .map((id) => porId.get(id))
      .filter((documento): documento is NonNullable<typeof documento> => documento !== undefined)
      .map((documento) => ({
        documento: aDocumentoDto(documento, sesion),
        trabajadorId: documento.trabajador.id,
        trabajador: nombreTrabajador(documento.trabajador),
        numeroDoc: documento.trabajador.numeroDoc,
      }));
    return { items, total };
  }

  private async coincidencias(texto: TextoBusqueda | null): Promise<CatalogosCoincidentes> {
    if (texto === null || texto.clase !== 'NOMBRE') {
      return SIN_COINCIDENCIAS;
    }
    const [areas, cargos, tipos] = await Promise.all([
      this.prisma.area.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
      this.prisma.cargo.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
      this.prisma.tipoDocumento.findMany({ select: { id: true, nombre: true } }),
    ]);
    const coincide = (nombre: string) => normalizarBusqueda(nombre).includes(texto.normalizado);
    return {
      areas: areas.filter((area) => coincide(area.nombre)).map((area) => area.id),
      cargos: cargos.filter((cargo) => coincide(cargo.nombre)).map((cargo) => cargo.id),
      tipos: tipos.filter((tipo) => coincide(tipo.nombre)).map((tipo) => tipo.id),
    };
  }
}
