import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aTexto, aTextoOpcional, hoyEnLima, normalizarBusqueda } from '../common/dates';
import { nombreTrabajador } from '../common/names';
import { enviarLibro, type CeldaValor, type ColumnaHoja } from '../common/xlsx-stream';
import { filtroVisibilidad } from '../documents/document.mapper';
import { TEXTO_MOVIMIENTO } from '../workers/labels';
import type {
  GeneralReportDto,
  GeneralReportFiltersDto,
  GeneralReportQueryDto,
  GeneralReportSummaryDto,
  StatisticsDto,
  TipoReporte,
} from './dto/general-report.dto';

const LIMITE_VISTA = 30;
const LIMITE_IMPRESION = 5000;
const BLOQUE = 1000;

const TEXTO_ESTADO_DOCUMENTO: Readonly<Record<string, string>> = {
  DISPONIBLE: 'REGISTRADO',
  PROCESANDO: 'PROCESANDO',
  ERROR: 'CON ERROR',
  ANULADO: 'ANULADO',
};

const NOMBRE_REPORTE: Readonly<Record<TipoReporte, string>> = {
  general: 'Padrón general de trabajadores',
  situacion: 'Personal por situación laboral',
  regimen: 'Personal por régimen',
  documentos: 'Inventario de documentos',
  secciones: 'Documentos vigentes por sección',
  estadisticas: 'Estadísticas del personal',
};

const COLUMNAS: Readonly<Record<'personal' | 'documentos' | 'estadisticas', ColumnaHoja[]>> = {
  personal: [
    { titulo: 'DNI', ancho: 12 },
    { titulo: 'Apellidos y nombres', ancho: 38 },
    { titulo: 'Cargo', ancho: 28 },
    { titulo: 'Área', ancho: 30 },
    { titulo: 'Régimen', ancho: 22 },
    { titulo: 'Situación laboral', ancho: 16 },
    { titulo: 'Último movimiento', ancho: 20 },
    { titulo: 'Fecha de ingreso', ancho: 15, tipo: 'fecha' },
    { titulo: 'Documentos registrados', ancho: 13, tipo: 'numero' },
    { titulo: 'PDF cargados', ancho: 12, tipo: 'numero' },
  ],
  documentos: [
    { titulo: 'DNI', ancho: 12 },
    { titulo: 'Trabajador', ancho: 36 },
    { titulo: 'Sección', ancho: 9, tipo: 'numero' },
    { titulo: 'Nombre de sección', ancho: 34 },
    { titulo: 'Tipo', ancho: 40 },
    { titulo: 'Documento', ancho: 36 },
    { titulo: 'Fecha de emisión', ancho: 15, tipo: 'fecha' },
    { titulo: 'Estado', ancho: 13 },
    { titulo: 'PDF disponible', ancho: 13 },
  ],
  estadisticas: [
    { titulo: 'Estado / Régimen', ancho: 40 },
    { titulo: 'Cantidad', ancho: 12, tipo: 'numero' },
  ],
};

const seleccionTrabajador = {
  id: true,
  numeroDoc: true,
  nombres: true,
  apellidoPaterno: true,
  apellidoMaterno: true,
  estado: true,
  movimientoActual: true,
  fechaIngreso: true,
  vinculos: {
    where: { actual: true },
    take: 1,
    select: { cargo: { select: { nombre: true } }, area: { select: { nombre: true } }, regimen: { select: { nombre: true } } },
  },
} satisfies Prisma.TrabajadorSelect;

type TrabajadorReporte = Prisma.TrabajadorGetPayload<{ select: typeof seleccionTrabajador }>;

const seleccionDocumento = {
  id: true,
  estado: true,
  fechaEmision: true,
  numero: true,
  trabajador: { select: { numeroDoc: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true } },
  tipoDocumento: { select: { nombre: true, seccion: { select: { numero: true, nombre: true } } } },
  archivoActual: { select: { nombreOriginal: true } },
} satisfies Prisma.DocumentoSelect;

type DocumentoReporte = Prisma.DocumentoGetPayload<{ select: typeof seleccionDocumento }>;

function familia(tipo: TipoReporte): 'personal' | 'documentos' | 'estadisticas' {
  if (tipo === 'documentos' || tipo === 'secciones') {
    return 'documentos';
  }
  return tipo === 'estadisticas' ? 'estadisticas' : 'personal';
}

@Injectable()
export class GeneralReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
  ) {}

  async reporte(consulta: GeneralReportQueryDto, sesion: SesionActiva): Promise<GeneralReportDto> {
    const limite = consulta.todos === true ? LIMITE_IMPRESION : LIMITE_VISTA;
    const [resumen, contenido] = await Promise.all([this.resumen(consulta, sesion), this.contenido(consulta, sesion, limite)]);
    return {
      tipo: consulta.tipo,
      columnas: COLUMNAS[familia(consulta.tipo)].map((columna) => columna.titulo),
      filas: contenido.filas,
      total: contenido.total,
      resumen,
    };
  }

  async exportar(consulta: GeneralReportFiltersDto, sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    await this.auditoria.registrar({
      accion: 'REPORTE_EXPORTAR',
      entidad: 'reporte',
      entidadId: consulta.tipo,
      usuarioId: sesion.usuarioId,
      cliente,
      detalle: { reporte: consulta.tipo, filtros: this.filtrosAuditables(consulta) },
    });
    const filas =
      familia(consulta.tipo) === 'documentos'
        ? this.documentosPorBloques(consulta, sesion)
        : (await this.contenido(consulta, sesion, Number.MAX_SAFE_INTEGER)).filas;
    await enviarLibro(respuesta, {
      nombreArchivo: `reporte_${consulta.tipo}_${hoyEnLima()}`,
      hoja: NOMBRE_REPORTE[consulta.tipo].slice(0, 31),
      columnas: COLUMNAS[familia(consulta.tipo)],
      filas,
    });
  }

  async estadisticas(sesion: SesionActiva): Promise<StatisticsDto> {
    const visibles: Prisma.DocumentoWhereInput = { AND: [filtroVisibilidad(sesion), { estado: { not: 'ANULADO' } }] };
    const [estados, porRegimen, documentos, pdf, porTipo, secciones, regimenes] = await Promise.all([
      this.prisma.trabajador.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.prisma.vinculo.groupBy({ by: ['regimenId'], where: { actual: true }, _count: { _all: true } }),
      this.prisma.documento.count({ where: visibles }),
      this.prisma.documento.count({ where: { AND: [filtroVisibilidad(sesion), { estado: 'DISPONIBLE' }] } }),
      this.prisma.documento.groupBy({ by: ['tipoDocumentoId'], where: visibles, _count: { _all: true } }),
      this.prisma.seccion.findMany({ select: { numero: true, nombre: true, tipos: { select: { id: true } } }, orderBy: { numero: 'asc' } }),
      this.prisma.regimen.findMany({ select: { id: true, nombre: true } }),
    ]);
    const activos = estados.find((fila) => fila.estado === 'ACTIVO')?._count._all ?? 0;
    const cesados = estados.find((fila) => fila.estado === 'CESADO')?._count._all ?? 0;
    const cantidadPorTipo = new Map(porTipo.map((fila) => [fila.tipoDocumentoId, fila._count._all]));
    return {
      trabajadores: activos + cesados,
      activos,
      cesados,
      documentos,
      pdf,
      porSeccion: secciones
        .filter((seccion) => seccion.numero > 1 && !sesion.seccionesRestringidas.includes(seccion.numero))
        .map((seccion) => ({
          nombre: `${String(seccion.numero).padStart(2, '0')} · ${seccion.nombre}`,
          cantidad: seccion.tipos.reduce((suma, tipo) => suma + (cantidadPorTipo.get(tipo.id) ?? 0), 0),
        })),
      porRegimen: porRegimen
        .map((fila) => ({
          nombre: regimenes.find((regimen) => regimen.id === fila.regimenId)?.nombre ?? 'Sin régimen',
          cantidad: fila._count._all,
        }))
        .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es')),
    };
  }

  async exportarEstadisticas(sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    const datos = await this.estadisticas(sesion);
    await this.auditoria.registrar({
      accion: 'REPORTE_EXPORTAR',
      entidad: 'reporte',
      entidadId: 'indicadores',
      usuarioId: sesion.usuarioId,
      cliente,
      detalle: { reporte: 'indicadores' },
    });
    const filas: CeldaValor[][] = [
      ['Personal', 'Trabajadores', datos.trabajadores],
      ['Personal', 'Activos', datos.activos],
      ['Personal', 'Cesados', datos.cesados],
      ['Documentos', 'Vigentes', datos.documentos],
      ['Documentos', 'PDF registrados', datos.pdf],
      ...datos.porSeccion.map((fila): CeldaValor[] => ['Sección', fila.nombre, fila.cantidad]),
      ...datos.porRegimen.map((fila): CeldaValor[] => ['Régimen', fila.nombre, fila.cantidad]),
    ];
    await enviarLibro(respuesta, {
      nombreArchivo: `indicadores_${hoyEnLima()}`,
      hoja: 'Indicadores',
      columnas: [
        { titulo: 'Indicador', ancho: 16 },
        { titulo: 'Detalle', ancho: 48 },
        { titulo: 'Cantidad', ancho: 12, tipo: 'numero' },
      ],
      filas,
    });
  }

  private async contenido(
    consulta: GeneralReportFiltersDto,
    sesion: SesionActiva,
    limite: number,
  ): Promise<{ filas: CeldaValor[][]; total: number }> {
    if (familia(consulta.tipo) === 'documentos') {
      const donde = this.filtroDocumentos(consulta, sesion);
      const [total, documentos] = await Promise.all([
        this.prisma.documento.count({ where: donde }),
        this.prisma.documento.findMany({ where: donde, select: seleccionDocumento, orderBy: this.ordenDocumentos(), take: limite }),
      ]);
      return { filas: documentos.map((documento) => this.filaDocumento(documento)), total };
    }
    const trabajadores = await this.prisma.trabajador.findMany({ where: this.filtroTrabajadores(consulta), select: seleccionTrabajador });
    if (consulta.tipo === 'estadisticas') {
      const grupos = new Map<string, number>();
      for (const trabajador of trabajadores) {
        const clave = `${trabajador.estado} / ${trabajador.vinculos[0]?.regimen.nombre ?? 'Sin régimen'}`;
        grupos.set(clave, (grupos.get(clave) ?? 0) + 1);
      }
      const filas = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([clave, cantidad]) => [clave, cantidad]);
      return { filas: filas.slice(0, limite), total: filas.length };
    }
    const conteos = await this.conteosPorTrabajador(consulta, sesion);
    const ordenados = this.ordenar(trabajadores, consulta.tipo);
    return {
      filas: ordenados.slice(0, limite).map((trabajador) => this.filaPersonal(trabajador, conteos.get(trabajador.id))),
      total: ordenados.length,
    };
  }

  private async resumen(consulta: GeneralReportFiltersDto, sesion: SesionActiva): Promise<GeneralReportSummaryDto> {
    const trabajadores = this.filtroTrabajadores(consulta);
    const visibles = filtroVisibilidad(sesion);
    const [cantidad, documentos, pdf] = await Promise.all([
      this.prisma.trabajador.count({ where: trabajadores }),
      this.prisma.documento.count({ where: { AND: [{ trabajador: trabajadores }, visibles, { estado: { not: 'ANULADO' } }] } }),
      this.prisma.documento.count({ where: { AND: [{ trabajador: trabajadores }, visibles, { estado: 'DISPONIBLE' }] } }),
    ]);
    return { trabajadores: cantidad, documentos, pdf };
  }

  private async conteosPorTrabajador(
    consulta: GeneralReportFiltersDto,
    sesion: SesionActiva,
  ): Promise<Map<string, { registrados: number; pdf: number }>> {
    const filas = await this.prisma.documento.groupBy({
      by: ['trabajadorId', 'estado'],
      where: { AND: [{ trabajador: this.filtroTrabajadores(consulta) }, filtroVisibilidad(sesion), { estado: { not: 'ANULADO' } }] },
      _count: { _all: true },
    });
    const conteos = new Map<string, { registrados: number; pdf: number }>();
    for (const fila of filas) {
      const actual = conteos.get(fila.trabajadorId) ?? { registrados: 0, pdf: 0 };
      actual.registrados += fila._count._all;
      if (fila.estado === 'DISPONIBLE') {
        actual.pdf += fila._count._all;
      }
      conteos.set(fila.trabajadorId, actual);
    }
    return conteos;
  }

  private async *documentosPorBloques(consulta: GeneralReportFiltersDto, sesion: SesionActiva): AsyncGenerator<CeldaValor[]> {
    const donde = this.filtroDocumentos(consulta, sesion);
    let salto = 0;
    for (;;) {
      const bloque = await this.prisma.documento.findMany({
        where: donde,
        select: seleccionDocumento,
        orderBy: this.ordenDocumentos(),
        take: BLOQUE,
        skip: salto,
      });
      for (const documento of bloque) {
        yield this.filaDocumento(documento);
      }
      if (bloque.length < BLOQUE) {
        return;
      }
      salto += bloque.length;
    }
  }

  private filtroTrabajadores(consulta: GeneralReportFiltersDto): Prisma.TrabajadorWhereInput {
    const condiciones: Prisma.TrabajadorWhereInput[] = [];
    if (consulta.estado !== undefined && consulta.estado !== null) {
      condiciones.push({ estado: consulta.estado });
    }
    if (consulta.areaId !== undefined || consulta.regimenId !== undefined) {
      condiciones.push({ vinculos: { some: { actual: true, areaId: consulta.areaId, regimenId: consulta.regimenId } } });
    }
    if (consulta.ingresoDesde !== undefined && consulta.ingresoDesde !== null) {
      condiciones.push({ fechaIngreso: { gte: new Date(`${consulta.ingresoDesde}T00:00:00.000Z`) } });
    }
    if (consulta.ingresoHasta !== undefined && consulta.ingresoHasta !== null) {
      condiciones.push({ fechaIngreso: { lte: new Date(`${consulta.ingresoHasta}T00:00:00.000Z`) } });
    }
    const termino = consulta.busqueda ?? null;
    if (termino !== null) {
      const palabras = normalizarBusqueda(termino).split(/\s+/).filter((palabra) => palabra.length > 0);
      condiciones.push({
        OR: [
          { numeroDoc: { startsWith: termino.trim().toUpperCase() } },
          { AND: palabras.map((palabra) => ({ nombreBusqueda: { contains: palabra } })) },
          { vinculos: { some: { actual: true, cargo: { nombre: { contains: termino.trim(), mode: 'insensitive' } } } } },
        ],
      });
    }
    return { AND: condiciones };
  }

  private filtroDocumentos(consulta: GeneralReportFiltersDto, sesion: SesionActiva): Prisma.DocumentoWhereInput {
    return {
      AND: [
        { trabajador: this.filtroTrabajadores(consulta) },
        filtroVisibilidad(sesion),
        consulta.tipo === 'secciones' ? { estado: 'DISPONIBLE' } : {},
      ],
    };
  }

  private ordenDocumentos(): Prisma.DocumentoOrderByWithRelationInput[] {
    return [
      { trabajador: { apellidoPaterno: 'asc' } },
      { trabajador: { nombres: 'asc' } },
      { trabajadorId: 'asc' },
      { tipoDocumento: { seccion: { numero: 'asc' } } },
      { fechaEmision: 'asc' },
      { id: 'asc' },
    ];
  }

  private ordenar(trabajadores: TrabajadorReporte[], tipo: TipoReporte): TrabajadorReporte[] {
    const porNombre = (a: TrabajadorReporte, b: TrabajadorReporte) => nombreTrabajador(a).localeCompare(nombreTrabajador(b), 'es');
    return [...trabajadores].sort((a, b) => {
      if (tipo === 'situacion' && a.estado !== b.estado) {
        return a.estado.localeCompare(b.estado);
      }
      if (tipo === 'regimen') {
        const comparacion = (a.vinculos[0]?.regimen.nombre ?? '').localeCompare(b.vinculos[0]?.regimen.nombre ?? '', 'es');
        if (comparacion !== 0) {
          return comparacion;
        }
      }
      return porNombre(a, b);
    });
  }

  private filaPersonal(trabajador: TrabajadorReporte, conteo: { registrados: number; pdf: number } | undefined): CeldaValor[] {
    const vinculo = trabajador.vinculos[0];
    return [
      trabajador.numeroDoc,
      nombreTrabajador(trabajador),
      vinculo?.cargo.nombre ?? null,
      vinculo?.area.nombre ?? null,
      vinculo?.regimen.nombre ?? null,
      trabajador.estado,
      TEXTO_MOVIMIENTO[trabajador.movimientoActual].toUpperCase(),
      aTexto(trabajador.fechaIngreso),
      conteo?.registrados ?? 0,
      conteo?.pdf ?? 0,
    ];
  }

  private filaDocumento(documento: DocumentoReporte): CeldaValor[] {
    return [
      documento.trabajador.numeroDoc,
      nombreTrabajador(documento.trabajador),
      documento.tipoDocumento.seccion.numero,
      documento.tipoDocumento.seccion.nombre,
      documento.tipoDocumento.nombre,
      documento.archivoActual?.nombreOriginal ?? documento.numero ?? 'Sin archivo',
      aTextoOpcional(documento.fechaEmision),
      TEXTO_ESTADO_DOCUMENTO[documento.estado] ?? documento.estado,
      documento.estado === 'DISPONIBLE' ? 'SÍ' : 'NO',
    ];
  }

  private filtrosAuditables(consulta: GeneralReportFiltersDto): Record<string, string | number> {
    const filtros: Record<string, string | number> = {};
    for (const [clave, valor] of Object.entries(consulta)) {
      if (typeof valor === 'string' || typeof valor === 'number') {
        filtros[clave] = valor;
      }
    }
    return filtros;
  }
}
