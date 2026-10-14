import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import { aTextoDeFila, hoyEnLima } from '../common/dates';
import { nombreTrabajador } from '../common/names';
import type { SesionActiva } from '../common/session';
import { enviarLibro, type CeldaValor, type ColumnaHoja } from '../common/xlsx-stream';
import { filtroVisibilidad } from '../documents/document.mapper';
import type { EstadoValor, TipoPersonalValor } from '../workers/dto/worker.dto';
import type {
  DigitizationQueryDto,
  ExpiringQueryDto,
  MissingSummaryQueryDto,
  ProgressQueryDto,
  StaffReportQueryDto,
} from './dto/report-query.dto';
import type {
  DigitizationReportDto,
  DigitizationRowDto,
  DigitizationUserDto,
  ExpiringReportDto,
  ExpiringRowDto,
  MissingSummaryDto,
  ProgressReportDto,
  ProgressRowDto,
  SituacionValor,
  StaffReportDto,
  StaffRowDto,
  SummaryColumnDto,
  SummaryRowDto,
  WorkerMissingDto,
} from './dto/report.dto';
import {
  AVANCE_SELECT,
  ORDEN_PERSONAL,
  PERSONAL_SELECT,
  VINCULO_ACTUAL,
  baseCompletitud,
  tiposVisibles,
  unir,
  visibilidadDocumento,
} from './report-queries';

const POR_PAGINA = 25;
const BLOQUE = 200;
const LIMITE_FILAS = 2000;
const DIAS_POR_OMISION = 30;
const TEXTO_TIPO_PERSONAL = { ADMINISTRATIVO: 'Administrativo', ASISTENCIAL: 'Asistencial' } as const;
const TEXTO_ESTADO = { ACTIVO: 'Activo', CESADO: 'Cesado' } as const;
const TEXTO_SITUACION = { COMPLETO: 'Completo', FALTANTE: 'Faltante', VENCIDO: 'Vencido', NO_APLICA: '' } as const;

interface FilaTotal {
  total: number;
}

interface FilaPersonal {
  id: string;
  numero_doc: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  estado: EstadoValor;
  fecha_ingreso: Date | string;
  tipo_personal: TipoPersonalValor | null;
  regimen: string | null;
  cargo: string | null;
  area: string | null;
  requisitos: number;
  completos: number;
  vencidos: number;
  faltantes: number;
}

interface FilaSituacion {
  trabajador_id: string;
  tipo_id: number;
  codigo: string;
  nombre: string;
  seccion: number;
  situacion: SituacionValor;
  documento_id: string | null;
  fecha_emision: Date | string | null;
  fecha_vencimiento: Date | string | null;
}

interface FilaColumna {
  tipo_id: number;
  codigo: string;
  nombre: string;
  seccion: number;
}

interface FilaConsolidado {
  id: string;
  numero_doc: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  area: string | null;
  requisitos: number;
  completos: number;
  faltantes: number;
  vencidos: number;
}

interface FilaVencimiento {
  documento_id: string;
  trabajador_id: string;
  numero_doc: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  area: string | null;
  seccion: number;
  codigo: string;
  tipo: string;
  numero: string | null;
  fecha_emision: Date | string | null;
  fecha_vencimiento: Date | string;
  dias: number;
}

interface FilaDigitalizacion {
  usuario: string;
  dia: Date | string;
  documentos: number;
  folios: number;
  tamano: number;
}

interface FilaAvance {
  area: string;
  trabajadores: number;
  completos: number;
  parciales: number;
  vacios: number;
  logrados: number;
  exigidos: number;
}

function completitud(completos: number, requisitos: number): number {
  return requisitos === 0 ? 100 : Math.round((completos / requisitos) * 100);
}

function nombreDeFila(fila: { nombres: string; apellido_paterno: string; apellido_materno: string | null }): string {
  return nombreTrabajador({ nombres: fila.nombres, apellidoPaterno: fila.apellido_paterno, apellidoMaterno: fila.apellido_materno });
}

function filtrosAuditables(consulta: object): Record<string, string | number | boolean> {
  const detalle: Record<string, string | number | boolean> = {};
  for (const [clave, valor] of Object.entries(consulta)) {
    if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
      detalle[clave] = valor;
    }
  }
  return detalle;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
  ) {}

  async personal(consulta: StaffReportQueryDto, sesion: SesionActiva): Promise<StaffReportDto> {
    const pagina = consulta.pagina ?? 1;
    const base = baseCompletitud(consulta, sesion, hoyEnLima());
    const [conteo, filas] = await Promise.all([
      this.prisma.$queryRaw<FilaTotal[]>(Prisma.sql`${base} SELECT count(*)::int AS total FROM base b`),
      this.prisma.$queryRaw<FilaPersonal[]>(
        Prisma.sql`${base} ${PERSONAL_SELECT} ${ORDEN_PERSONAL} LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`,
      ),
    ]);
    return { items: filas.map(aPersonalDto), total: conteo[0]?.total ?? 0, pagina, porPagina: POR_PAGINA };
  }

  async faltantes(trabajadorId: string, sesion: SesionActiva): Promise<WorkerMissingDto> {
    const trabajador = await this.prisma.trabajador.findUnique({
      where: { id: trabajadorId },
      select: { id: true, numeroDoc: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true },
    });
    if (trabajador === null) {
      throw new NotFoundException('El trabajador no existe');
    }
    const base = baseCompletitud({}, sesion, hoyEnLima(), [trabajadorId]);
    const filas = await this.prisma.$queryRaw<FilaSituacion[]>(Prisma.sql`
      ${base}
      SELECT e.trabajador_id, e.tipo_id, e.codigo, e.nombre, e.seccion, e.situacion,
             e.documento_id, e.fecha_emision, e.fecha_vencimiento
      FROM estados e
      ORDER BY e.codigo`);
    const items = filas.map((fila) => ({
      tipoId: fila.tipo_id,
      codigo: fila.codigo,
      tipo: fila.nombre,
      seccion: fila.seccion,
      situacion: fila.situacion,
      documentoId: fila.documento_id,
      fechaEmision: aTextoDeFila(fila.fecha_emision),
      fechaVencimiento: aTextoDeFila(fila.fecha_vencimiento),
    }));
    const cuenta = (situacion: SituacionValor) => items.filter((item) => item.situacion === situacion).length;
    const completos = cuenta('COMPLETO');
    return {
      trabajadorId: trabajador.id,
      numeroDoc: trabajador.numeroDoc,
      nombre: nombreTrabajador(trabajador),
      requisitos: items.length,
      completos,
      vencidos: cuenta('VENCIDO'),
      faltantes: cuenta('FALTANTE'),
      completitud: completitud(completos, items.length),
      items,
    };
  }

  async consolidado(consulta: MissingSummaryQueryDto, sesion: SesionActiva): Promise<MissingSummaryDto> {
    const pagina = consulta.pagina ?? 1;
    const [columnas, conteo, filas] = await Promise.all([
      this.columnasConsolidado(consulta, sesion),
      this.totalConsolidado(consulta, sesion),
      this.filasConsolidado(consulta, sesion, POR_PAGINA, (pagina - 1) * POR_PAGINA),
    ]);
    const items = await this.filasConMarcas(filas, columnas, sesion);
    return { columnas, items, total: conteo, pagina, porPagina: POR_PAGINA };
  }

  async porVencer(consulta: ExpiringQueryDto, sesion: SesionActiva): Promise<ExpiringReportDto> {
    const dias = consulta.dias ?? DIAS_POR_OMISION;
    const ambito: Prisma.DocumentoWhereInput = {
      AND: [
        filtroVisibilidad(sesion),
        { estado: 'DISPONIBLE' },
        consulta.tipoDocumentoId === undefined ? {} : { tipoDocumentoId: consulta.tipoDocumentoId },
        consulta.areaId === undefined ? {} : { trabajador: { vinculos: { some: { actual: true, areaId: consulta.areaId } } } },
      ],
    };
    const [filas, conFecha, sinFecha] = await Promise.all([
      this.filasVencimiento(consulta, sesion, dias, LIMITE_FILAS, 0),
      this.prisma.documento.count({ where: { AND: [ambito, { fechaVencimiento: { not: null } }] } }),
      this.prisma.documento.count({ where: { AND: [ambito, { fechaVencimiento: null }] } }),
    ]);
    const items = filas.map(aVencimientoDto);
    return {
      items,
      dias,
      vencidos: items.filter((item) => item.dias < 0).length,
      porVencer: items.filter((item) => item.dias >= 0).length,
      conFecha,
      sinFecha,
    };
  }

  async digitalizacion(consulta: DigitizationQueryDto, sesion: SesionActiva): Promise<DigitizationReportDto> {
    const [filas, usuarios] = await Promise.all([
      this.filasDigitalizacion(consulta, sesion, LIMITE_FILAS, 0),
      this.prisma.$queryRaw<DigitizationUserDto[]>(Prisma.sql`
        SELECT DISTINCT u.id, u.nombre_completo AS nombre
        FROM documento d
        JOIN usuario u ON u.id = d.creado_por
        ORDER BY u.nombre_completo`),
    ]);
    const items = filas.map(aDigitalizacionDto);
    return {
      items,
      usuarios,
      documentos: items.reduce((total, item) => total + item.documentos, 0),
      folios: items.reduce((total, item) => total + item.folios, 0),
      tamano: items.reduce((total, item) => total + item.tamano, 0),
    };
  }

  async avance(consulta: ProgressQueryDto, sesion: SesionActiva): Promise<ProgressReportDto> {
    const base = baseCompletitud(consulta, sesion, hoyEnLima());
    const filas = await this.prisma.$queryRaw<FilaAvance[]>(Prisma.sql`${base} ${AVANCE_SELECT}`);
    const items = filas.map(aAvanceDto);
    const sumar = (tomar: (fila: FilaAvance) => number) => filas.reduce((total, fila) => total + tomar(fila), 0);
    const logrados = sumar((fila) => fila.logrados);
    const exigidos = sumar((fila) => fila.exigidos);
    return {
      items,
      totales: {
        area: 'Todas las áreas',
        trabajadores: sumar((fila) => fila.trabajadores),
        completos: sumar((fila) => fila.completos),
        parciales: sumar((fila) => fila.parciales),
        vacios: sumar((fila) => fila.vacios),
        completitud: completitud(logrados, exigidos),
      },
    };
  }

  async exportarPersonal(consulta: StaffReportQueryDto, sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    await this.anotar('personal', consulta, sesion, cliente);
    const base = baseCompletitud(consulta, sesion, hoyEnLima());
    const columnas: ColumnaHoja[] = [
      { titulo: 'Documento', ancho: 14 },
      { titulo: 'Trabajador', ancho: 38 },
      { titulo: 'Régimen', ancho: 26 },
      { titulo: 'Tipo de personal', ancho: 18 },
      { titulo: 'Cargo', ancho: 28 },
      { titulo: 'Área', ancho: 30 },
      { titulo: 'Fecha de ingreso', ancho: 16, tipo: 'fecha' },
      { titulo: 'Estado laboral', ancho: 14 },
      { titulo: 'Requisitos', ancho: 11, tipo: 'numero' },
      { titulo: 'Completos', ancho: 11, tipo: 'numero' },
      { titulo: 'Faltantes', ancho: 11, tipo: 'numero' },
      { titulo: 'Vencidos', ancho: 11, tipo: 'numero' },
      { titulo: 'Completitud %', ancho: 13, tipo: 'numero' },
    ];
    const cargar = (limite: number, salto: number) =>
      this.prisma.$queryRaw<FilaPersonal[]>(Prisma.sql`${base} ${PERSONAL_SELECT} ${ORDEN_PERSONAL} LIMIT ${limite} OFFSET ${salto}`);
    await enviarLibro(respuesta, {
      nombreArchivo: `personal_${hoyEnLima()}`,
      hoja: 'Personal',
      columnas,
      filas: this.porBloques(cargar, (fila) => {
        const item = aPersonalDto(fila);
        return [
          item.numeroDoc,
          item.nombre,
          item.regimen,
          item.tipoPersonal === null ? null : TEXTO_TIPO_PERSONAL[item.tipoPersonal],
          item.cargo,
          item.area,
          item.fechaIngreso,
          TEXTO_ESTADO[item.estado],
          item.requisitos,
          item.completos,
          item.faltantes,
          item.vencidos,
          item.completitud,
        ];
      }),
    });
  }

  async exportarFaltantes(trabajadorId: string, sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    const reporte = await this.faltantes(trabajadorId, sesion);
    await this.anotar('faltantes', { trabajadorId }, sesion, cliente);
    const columnas: ColumnaHoja[] = [
      { titulo: 'Código', ancho: 10 },
      { titulo: 'Tipo de documento', ancho: 54 },
      { titulo: 'Sección', ancho: 9, tipo: 'numero' },
      { titulo: 'Situación', ancho: 14 },
      { titulo: 'Fecha de emisión', ancho: 16, tipo: 'fecha' },
      { titulo: 'Fecha de vencimiento', ancho: 19, tipo: 'fecha' },
    ];
    await enviarLibro(respuesta, {
      nombreArchivo: `faltantes_${reporte.numeroDoc}_${hoyEnLima()}`,
      hoja: 'Faltantes',
      columnas,
      filas: reporte.items.map((item): CeldaValor[] => [
        item.codigo,
        item.tipo,
        item.seccion,
        TEXTO_SITUACION[item.situacion],
        item.fechaEmision,
        item.fechaVencimiento,
      ]),
    });
  }

  async exportarConsolidado(consulta: MissingSummaryQueryDto, sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    await this.anotar('consolidado', consulta, sesion, cliente);
    const columnasTipo = await this.columnasConsolidado(consulta, sesion);
    const columnas: ColumnaHoja[] = [
      { titulo: 'Documento', ancho: 14 },
      { titulo: 'Trabajador', ancho: 38 },
      { titulo: 'Área', ancho: 30 },
      ...columnasTipo.map((columna): ColumnaHoja => ({ titulo: `${columna.codigo} ${columna.nombre}`, ancho: 22 })),
      { titulo: 'Faltantes', ancho: 11, tipo: 'numero' },
      { titulo: 'Vencidos', ancho: 11, tipo: 'numero' },
      { titulo: 'Completitud %', ancho: 13, tipo: 'numero' },
    ];
    await enviarLibro(respuesta, {
      nombreArchivo: `faltantes_consolidado_${hoyEnLima()}`,
      hoja: 'Consolidado',
      columnas,
      filas: this.consolidadoPorBloques(consulta, sesion, columnasTipo),
    });
  }

  async exportarPorVencer(consulta: ExpiringQueryDto, sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    await this.anotar('vencimientos', consulta, sesion, cliente);
    const dias = consulta.dias ?? DIAS_POR_OMISION;
    const columnas: ColumnaHoja[] = [
      { titulo: 'Documento', ancho: 14 },
      { titulo: 'Trabajador', ancho: 38 },
      { titulo: 'Área', ancho: 30 },
      { titulo: 'Sección', ancho: 9, tipo: 'numero' },
      { titulo: 'Código', ancho: 10 },
      { titulo: 'Tipo de documento', ancho: 46 },
      { titulo: 'Número', ancho: 20 },
      { titulo: 'Fecha de emisión', ancho: 16, tipo: 'fecha' },
      { titulo: 'Fecha de vencimiento', ancho: 19, tipo: 'fecha' },
      { titulo: 'Días', ancho: 9, tipo: 'numero' },
      { titulo: 'Situación', ancho: 14 },
    ];
    const cargar = (limite: number, salto: number) => this.filasVencimiento(consulta, sesion, dias, limite, salto);
    await enviarLibro(respuesta, {
      nombreArchivo: `vencimientos_${hoyEnLima()}`,
      hoja: 'Vencimientos',
      columnas,
      filas: this.porBloques(cargar, (fila) => {
        const item = aVencimientoDto(fila);
        return [
          item.numeroDoc,
          item.trabajador,
          item.area,
          item.seccion,
          item.codigo,
          item.tipo,
          item.numero,
          item.fechaEmision,
          item.fechaVencimiento,
          item.dias,
          item.dias < 0 ? 'Vencido' : 'Por vencer',
        ];
      }),
    });
  }

  async exportarDigitalizacion(consulta: DigitizationQueryDto, sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    await this.anotar('digitalizacion', consulta, sesion, cliente);
    const columnas: ColumnaHoja[] = [
      { titulo: 'Día', ancho: 13, tipo: 'fecha' },
      { titulo: 'Usuario', ancho: 34 },
      { titulo: 'Documentos', ancho: 12, tipo: 'numero' },
      { titulo: 'Folios', ancho: 10, tipo: 'numero' },
      { titulo: 'Tamaño en MB', ancho: 14, tipo: 'numero' },
    ];
    const cargar = (limite: number, salto: number) => this.filasDigitalizacion(consulta, sesion, limite, salto);
    await enviarLibro(respuesta, {
      nombreArchivo: `digitalizacion_${hoyEnLima()}`,
      hoja: 'Digitalización',
      columnas,
      filas: this.porBloques(cargar, (fila) => {
        const item = aDigitalizacionDto(fila);
        return [item.dia, item.usuario, item.documentos, item.folios, Math.round((item.tamano / 1048576) * 100) / 100];
      }),
    });
  }

  async exportarAvance(consulta: ProgressQueryDto, sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    const reporte = await this.avance(consulta, sesion);
    await this.anotar('avance', consulta, sesion, cliente);
    const columnas: ColumnaHoja[] = [
      { titulo: 'Área', ancho: 36 },
      { titulo: 'Trabajadores', ancho: 13, tipo: 'numero' },
      { titulo: 'Legajos completos', ancho: 17, tipo: 'numero' },
      { titulo: 'Parciales', ancho: 11, tipo: 'numero' },
      { titulo: 'Vacíos', ancho: 10, tipo: 'numero' },
      { titulo: 'Completitud %', ancho: 13, tipo: 'numero' },
    ];
    const filas = [...reporte.items, reporte.totales].map((item): CeldaValor[] => [
      item.area,
      item.trabajadores,
      item.completos,
      item.parciales,
      item.vacios,
      item.completitud,
    ]);
    await enviarLibro(respuesta, { nombreArchivo: `avance_${hoyEnLima()}`, hoja: 'Avance', columnas, filas });
  }

  private async anotar(reporte: string, consulta: object, sesion: SesionActiva, cliente: DatosCliente): Promise<void> {
    await this.auditoria.registrar({
      accion: 'REPORTE_EXPORTAR',
      entidad: 'reporte',
      entidadId: reporte,
      usuarioId: sesion.usuarioId,
      cliente,
      detalle: { reporte, filtros: filtrosAuditables(consulta) },
    });
  }

  private async *consolidadoPorBloques(
    consulta: MissingSummaryQueryDto,
    sesion: SesionActiva,
    columnas: SummaryColumnDto[],
  ): AsyncGenerator<CeldaValor[]> {
    let salto = 0;
    for (;;) {
      const bloque = await this.filasConsolidado(consulta, sesion, BLOQUE, salto);
      const items = await this.filasConMarcas(bloque, columnas, sesion);
      for (const item of items) {
        yield [
          item.numeroDoc,
          item.nombre,
          item.area,
          ...item.celdas.map((celda) => TEXTO_SITUACION[celda]),
          item.faltantes,
          item.vencidos,
          completitud(item.completos, item.requisitos),
        ];
      }
      if (bloque.length < BLOQUE) {
        return;
      }
      salto += bloque.length;
    }
  }

  private async *porBloques<T>(
    cargar: (limite: number, salto: number) => Promise<T[]>,
    convertir: (fila: T) => CeldaValor[],
  ): AsyncGenerator<CeldaValor[]> {
    let salto = 0;
    for (;;) {
      const bloque = await cargar(BLOQUE, salto);
      for (const fila of bloque) {
        yield convertir(fila);
      }
      if (bloque.length < BLOQUE) {
        return;
      }
      salto += bloque.length;
    }
  }

  private async columnasConsolidado(consulta: MissingSummaryQueryDto, sesion: SesionActiva): Promise<SummaryColumnDto[]> {
    const base = baseCompletitud(consulta, sesion, hoyEnLima());
    const filas = await this.prisma.$queryRaw<FilaColumna[]>(Prisma.sql`
      ${base}
      SELECT DISTINCT e.tipo_id, e.codigo, e.nombre, e.seccion FROM exigidos e ORDER BY e.codigo`);
    return filas.map((fila) => ({ tipoId: fila.tipo_id, codigo: fila.codigo, nombre: fila.nombre, seccion: fila.seccion }));
  }

  private async totalConsolidado(consulta: MissingSummaryQueryDto, sesion: SesionActiva): Promise<number> {
    const base = baseCompletitud(consulta, sesion, hoyEnLima());
    const conteo = await this.prisma.$queryRaw<FilaTotal[]>(Prisma.sql`
      ${base}
      SELECT count(*)::int AS total
      FROM base b
      LEFT JOIN resumen r ON r.trabajador_id = b.id
      WHERE ${this.filtroIncompletos(consulta)}`);
    return conteo[0]?.total ?? 0;
  }

  private filtroIncompletos(consulta: MissingSummaryQueryDto): Prisma.Sql {
    return consulta.soloIncompletos === true
      ? Prisma.sql`coalesce(r.faltantes, 0) + coalesce(r.vencidos, 0) > 0`
      : Prisma.sql`TRUE`;
  }

  private async filasConsolidado(
    consulta: MissingSummaryQueryDto,
    sesion: SesionActiva,
    limite: number,
    salto: number,
  ): Promise<FilaConsolidado[]> {
    const base = baseCompletitud(consulta, sesion, hoyEnLima());
    return this.prisma.$queryRaw<FilaConsolidado[]>(Prisma.sql`
      ${base}
      SELECT b.id, b.numero_doc, b.nombres, b.apellido_paterno, b.apellido_materno, a.nombre AS area,
             coalesce(r.requisitos, 0) AS requisitos,
             coalesce(r.completos, 0) AS completos,
             coalesce(r.faltantes, 0) AS faltantes,
             coalesce(r.vencidos, 0) AS vencidos
      FROM base b
      LEFT JOIN resumen r ON r.trabajador_id = b.id
      LEFT JOIN area a ON a.id = b.area_id
      WHERE ${this.filtroIncompletos(consulta)}
      ${ORDEN_PERSONAL}
      LIMIT ${limite} OFFSET ${salto}`);
  }

  private async filasConMarcas(
    filas: FilaConsolidado[],
    columnas: SummaryColumnDto[],
    sesion: SesionActiva,
  ): Promise<SummaryRowDto[]> {
    if (filas.length === 0) {
      return [];
    }
    const ids = filas.map((fila) => fila.id);
    const base = baseCompletitud({}, sesion, hoyEnLima(), ids);
    const marcas = await this.prisma.$queryRaw<Pick<FilaSituacion, 'trabajador_id' | 'tipo_id' | 'situacion'>[]>(Prisma.sql`
      ${base}
      SELECT e.trabajador_id, e.tipo_id, e.situacion FROM estados e`);
    const porTrabajador = new Map<string, Map<number, SituacionValor>>();
    for (const marca of marcas) {
      const actual = porTrabajador.get(marca.trabajador_id) ?? new Map<number, SituacionValor>();
      actual.set(marca.tipo_id, marca.situacion);
      porTrabajador.set(marca.trabajador_id, actual);
    }
    return filas.map((fila) => {
      const suyas = porTrabajador.get(fila.id) ?? new Map<number, SituacionValor>();
      return {
        id: fila.id,
        numeroDoc: fila.numero_doc,
        nombre: nombreDeFila(fila),
        area: fila.area,
        celdas: columnas.map((columna) => suyas.get(columna.tipoId) ?? 'NO_APLICA'),
        requisitos: fila.requisitos,
        completos: fila.completos,
        faltantes: fila.faltantes,
        vencidos: fila.vencidos,
      };
    });
  }

  private async filasVencimiento(
    consulta: ExpiringQueryDto,
    sesion: SesionActiva,
    dias: number,
    limite: number,
    salto: number,
  ): Promise<FilaVencimiento[]> {
    const hoy = hoyEnLima();
    const condiciones: Prisma.Sql[] = [
      Prisma.sql`d.estado = 'DISPONIBLE'`,
      Prisma.sql`d.fecha_vencimiento IS NOT NULL`,
      Prisma.sql`d.fecha_vencimiento <= (${hoy}::date + (${dias})::int)`,
      visibilidadDocumento(sesion, 'd'),
      tiposVisibles(sesion),
    ];
    if (consulta.areaId !== undefined) {
      condiciones.push(Prisma.sql`vi.area_id = ${consulta.areaId}`);
    }
    if (consulta.tipoDocumentoId !== undefined) {
      condiciones.push(Prisma.sql`d.tipo_documento_id = ${consulta.tipoDocumentoId}`);
    }
    return this.prisma.$queryRaw<FilaVencimiento[]>(Prisma.sql`
      SELECT d.id AS documento_id, t.id AS trabajador_id, t.numero_doc, t.nombres, t.apellido_paterno, t.apellido_materno,
             a.nombre AS area, s.numero AS seccion, td.codigo, td.nombre AS tipo,
             d.numero, d.fecha_emision, d.fecha_vencimiento,
             (d.fecha_vencimiento - ${hoy}::date)::int AS dias
      FROM documento d
      JOIN tipo_documento td ON td.id = d.tipo_documento_id
      JOIN seccion s ON s.id = td.seccion_id
      JOIN trabajador t ON t.id = d.trabajador_id
      ${VINCULO_ACTUAL}
      LEFT JOIN area a ON a.id = vi.area_id
      WHERE ${unir(condiciones)}
      ORDER BY d.fecha_vencimiento, t.apellido_paterno, t.nombres
      LIMIT ${limite} OFFSET ${salto}`);
  }

  private async filasDigitalizacion(
    consulta: DigitizationQueryDto,
    sesion: SesionActiva,
    limite: number,
    salto: number,
  ): Promise<FilaDigitalizacion[]> {
    const condiciones: Prisma.Sql[] = [
      Prisma.sql`d.estado IN ('DISPONIBLE', 'ANULADO')`,
      visibilidadDocumento(sesion, 'd'),
      tiposVisibles(sesion),
    ];
    if (consulta.usuarioId !== undefined && consulta.usuarioId !== null) {
      condiciones.push(Prisma.sql`d.creado_por = ${consulta.usuarioId}::uuid`);
    }
    if (consulta.desde !== undefined && consulta.desde !== null) {
      condiciones.push(Prisma.sql`(d.creado_en AT TIME ZONE 'America/Lima')::date >= ${consulta.desde}::date`);
    }
    if (consulta.hasta !== undefined && consulta.hasta !== null) {
      condiciones.push(Prisma.sql`(d.creado_en AT TIME ZONE 'America/Lima')::date <= ${consulta.hasta}::date`);
    }
    return this.prisma.$queryRaw<FilaDigitalizacion[]>(Prisma.sql`
      SELECT u.nombre_completo AS usuario,
             (d.creado_en AT TIME ZONE 'America/Lima')::date AS dia,
             count(*)::int AS documentos,
             coalesce(sum(ar.paginas), 0)::int AS folios,
             coalesce(sum(ar.tamano_final), 0)::float8 AS tamano
      FROM documento d
      JOIN usuario u ON u.id = d.creado_por
      JOIN tipo_documento td ON td.id = d.tipo_documento_id
      LEFT JOIN documento_archivo ar ON ar.id = d.archivo_actual_id
      WHERE ${unir(condiciones)}
      GROUP BY u.nombre_completo, (d.creado_en AT TIME ZONE 'America/Lima')::date
      ORDER BY (d.creado_en AT TIME ZONE 'America/Lima')::date DESC, u.nombre_completo
      LIMIT ${limite} OFFSET ${salto}`);
  }
}

function aPersonalDto(fila: FilaPersonal): StaffRowDto {
  return {
    id: fila.id,
    numeroDoc: fila.numero_doc,
    nombre: nombreDeFila(fila),
    regimen: fila.regimen,
    tipoPersonal: fila.tipo_personal,
    cargo: fila.cargo,
    area: fila.area,
    fechaIngreso: aTextoDeFila(fila.fecha_ingreso) ?? '',
    estado: fila.estado,
    requisitos: fila.requisitos,
    completos: fila.completos,
    vencidos: fila.vencidos,
    faltantes: fila.faltantes,
    completitud: completitud(fila.completos, fila.requisitos),
  };
}

function aVencimientoDto(fila: FilaVencimiento): ExpiringRowDto {
  return {
    documentoId: fila.documento_id,
    trabajadorId: fila.trabajador_id,
    numeroDoc: fila.numero_doc,
    trabajador: nombreDeFila(fila),
    area: fila.area,
    seccion: fila.seccion,
    codigo: fila.codigo,
    tipo: fila.tipo,
    numero: fila.numero,
    fechaEmision: aTextoDeFila(fila.fecha_emision),
    fechaVencimiento: aTextoDeFila(fila.fecha_vencimiento) ?? '',
    dias: fila.dias,
  };
}

function aDigitalizacionDto(fila: FilaDigitalizacion): DigitizationRowDto {
  return {
    usuario: fila.usuario,
    dia: aTextoDeFila(fila.dia) ?? '',
    documentos: fila.documentos,
    folios: fila.folios,
    tamano: fila.tamano,
  };
}

function aAvanceDto(fila: FilaAvance): ProgressRowDto {
  return {
    area: fila.area,
    trabajadores: fila.trabajadores,
    completos: fila.completos,
    parciales: fila.parciales,
    vacios: fila.vacios,
    completitud: completitud(fila.logrados, fila.exigidos),
  };
}
