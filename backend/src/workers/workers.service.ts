import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aFecha, aTexto, hoyEnLima, normalizarBusqueda } from '../common/dates';
import { sinDuplicados } from '../common/unique-violation';
import { enviarLibro, type CeldaValor, type ColumnaHoja } from '../common/xlsx-stream';
import type { CreateWorkerDto, LookupQueryDto, UpdateWorkerDto, WorkerQueryDto } from './dto/worker-input.dto';
import type { WorkerDetailDto, WorkerLookupDto, WorkerPageDto, WorkerSummaryDto } from './dto/worker.dto';
import { exigirCatalogosActivos } from './catalog-guard';
import { TEXTO_MOVIMIENTO } from './labels';
import { aDetalleDto, aDirectorioDto, aListadoDto, incluirDetalle, incluirDirectorio, incluirListado, validarDocumento, validarUbigeo } from './worker.mapper';

const MENSAJE_DUPLICADO = 'Ya existe un trabajador registrado con ese documento';
const LIMITE_EXPORTACION = 10000;

const TEXTO_ESTADO = { ACTIVO: 'Activo', CESADO: 'Cesado' } as const;
const TEXTO_MOTIVO = {
  RENUNCIA: 'Renuncia',
  JUBILACION: 'Jubilación',
  FALLECIMIENTO: 'Fallecimiento',
  FIN_CONTRATO: 'Fin de contrato',
  DESTITUCION: 'Destitución',
  OTRA_CAUSA: 'Otra causa',
  RENOVACION: 'Renovación',
  CAMBIO_REGIMEN: 'Cambio de régimen',
  CAMBIO_CARGO_O_AREA: 'Cambio de cargo o área',
} as const;

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
  ) {}

  async listar(consulta: WorkerQueryDto, sesion: SesionActiva): Promise<WorkerPageDto> {
    const pagina = consulta.pagina ?? 1;
    const porPagina = consulta.porPagina ?? 25;
    const where = this.filtro(consulta);
    const [total, trabajadores] = await this.prisma.$transaction([
      this.prisma.trabajador.count({ where }),
      this.prisma.trabajador.findMany({
        where,
        include: incluirDirectorio(sesion),
        orderBy: [{ apellidoPaterno: 'asc' }, { apellidoMaterno: 'asc' }, { nombres: 'asc' }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
    ]);
    return { items: trabajadores.map(aDirectorioDto), total, pagina, porPagina };
  }

  async resumen(): Promise<WorkerSummaryDto> {
    const [estados, movimientos, recientes] = await Promise.all([
      this.prisma.trabajador.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.prisma.trabajador.groupBy({
        by: ['movimientoActual'],
        where: { estado: 'ACTIVO', movimientoActual: { in: ['ROTACION', 'DESTAQUE'] } },
        _count: { _all: true },
      }),
      this.prisma.trabajador.findMany({
        where: { estado: 'ACTIVO' },
        include: incluirListado,
        orderBy: [{ fechaIngreso: 'desc' }, { creadoEn: 'desc' }],
        take: 5,
      }),
    ]);
    const contar = (estado: 'ACTIVO' | 'CESADO') => estados.find((fila) => fila.estado === estado)?._count._all ?? 0;
    const contarMovimiento = (movimiento: 'ROTACION' | 'DESTAQUE') =>
      movimientos.find((fila) => fila.movimientoActual === movimiento)?._count._all ?? 0;
    const activos = contar('ACTIVO');
    const cesados = contar('CESADO');
    return {
      total: activos + cesados,
      activos,
      cesados,
      rotados: contarMovimiento('ROTACION'),
      destacados: contarMovimiento('DESTAQUE'),
      recientes: recientes.map(aListadoDto),
    };
  }

  async exportar(consulta: WorkerQueryDto, respuesta: Response): Promise<void> {
    const trabajadores = await this.prisma.trabajador.findMany({
      where: this.filtro(consulta),
      include: incluirListado,
      orderBy: [{ apellidoPaterno: 'asc' }, { apellidoMaterno: 'asc' }, { nombres: 'asc' }],
      take: LIMITE_EXPORTACION,
    });
    const columnas: ColumnaHoja[] = [
      { titulo: 'N.º', ancho: 6, tipo: 'numero' },
      { titulo: 'Documento', ancho: 14 },
      { titulo: 'Apellido paterno', ancho: 20 },
      { titulo: 'Apellido materno', ancho: 20 },
      { titulo: 'Nombres', ancho: 24 },
      { titulo: 'Cargo', ancho: 28 },
      { titulo: 'Área', ancho: 30 },
      { titulo: 'Régimen', ancho: 26 },
      { titulo: 'Tipo de personal', ancho: 17 },
      { titulo: 'Estado laboral', ancho: 14, tipo: 'estado' },
      { titulo: 'Motivo de cese', ancho: 20 },
      { titulo: 'Fecha de cese', ancho: 14, tipo: 'fecha' },
      { titulo: 'Último movimiento', ancho: 18, tipo: 'estado' },
      { titulo: 'Fecha de ingreso', ancho: 14, tipo: 'fecha' },
    ];
    const filas = trabajadores.map((trabajador, indice): CeldaValor[] => {
      const vinculo = trabajador.vinculos[0];
      const cesado = trabajador.estado === 'CESADO';
      return [
        indice + 1,
        `${trabajador.tipoDocIdentidad} ${trabajador.numeroDoc}`,
        trabajador.apellidoPaterno,
        trabajador.apellidoMaterno,
        trabajador.nombres,
        vinculo?.cargo.nombre ?? null,
        vinculo?.area.nombre ?? null,
        vinculo?.regimen.nombre ?? null,
        vinculo === undefined ? null : vinculo.tipoPersonal === 'ADMINISTRATIVO' ? 'Administrativo' : 'Asistencial',
        TEXTO_ESTADO[trabajador.estado],
        cesado && vinculo?.motivoFin ? TEXTO_MOTIVO[vinculo.motivoFin] : null,
        cesado && vinculo?.fechaFin ? aTexto(vinculo.fechaFin) : null,
        TEXTO_MOVIMIENTO[trabajador.movimientoActual],
        aTexto(trabajador.fechaIngreso),
      ];
    });
    await enviarLibro(respuesta, {
      nombreArchivo: `trabajadores_${hoyEnLima()}`,
      hoja: 'Personal',
      titulo: 'Padrón de trabajadores',
      descripcion: await this.describirFiltros(consulta),
      columnas,
      filas,
    });
  }

  private async describirFiltros(consulta: WorkerQueryDto): Promise<string> {
    const [area, regimen] = await Promise.all([
      consulta.areaId === undefined ? null : this.prisma.area.findUnique({ where: { id: consulta.areaId }, select: { nombre: true } }),
      consulta.regimenId === undefined
        ? null
        : this.prisma.regimen.findUnique({ where: { id: consulta.regimenId }, select: { nombre: true } }),
    ]);
    const partes = [
      consulta.busqueda ? `Búsqueda: ${consulta.busqueda}` : null,
      consulta.estado ? `Estado: ${TEXTO_ESTADO[consulta.estado]}` : null,
      consulta.movimiento ? `Movimiento: ${TEXTO_MOVIMIENTO[consulta.movimiento]}` : null,
      area ? `Área: ${area.nombre}` : null,
      regimen ? `Régimen: ${regimen.nombre}` : null,
    ].filter((parte): parte is string => parte !== null);
    return partes.length === 0 ? 'Todos los trabajadores' : partes.join(' · ');
  }

  async buscarDocumento(consulta: LookupQueryDto): Promise<WorkerLookupDto> {
    const trabajador = await this.prisma.trabajador.findUnique({
      where: { tipoDocIdentidad_numeroDoc: { tipoDocIdentidad: consulta.tipo, numeroDoc: consulta.numero } },
      include: incluirListado,
    });
    return { existe: trabajador !== null, trabajador: trabajador === null ? null : aListadoDto(trabajador) };
  }

  async obtener(id: string): Promise<WorkerDetailDto> {
    return aDetalleDto(await this.cargar(id));
  }

  async crear(datos: CreateWorkerDto, actor: SesionActiva, cliente: DatosCliente): Promise<WorkerDetailDto> {
    validarDocumento(datos.tipoDocIdentidad, datos.numeroDoc);
    if (datos.fechaIngreso > hoyEnLima()) {
      throw new BadRequestException('La fecha de ingreso no puede ser futura');
    }
    const existente = await this.prisma.trabajador.findUnique({
      where: { tipoDocIdentidad_numeroDoc: { tipoDocIdentidad: datos.tipoDocIdentidad, numeroDoc: datos.numeroDoc } },
      select: { id: true },
    });
    if (existente !== null) {
      throw new ConflictException(MENSAJE_DUPLICADO);
    }
    await exigirCatalogosActivos(this.prisma, datos);

    const creado = await sinDuplicados(
      () =>
        this.prisma.$transaction(async (transaccion) => {
          const trabajador = await transaccion.trabajador.create({
            data: {
              tipoDocIdentidad: datos.tipoDocIdentidad,
              numeroDoc: datos.numeroDoc,
              nombres: datos.nombres,
              apellidoPaterno: datos.apellidoPaterno,
              apellidoMaterno: datos.apellidoMaterno ?? null,
              fechaIngreso: aFecha(datos.fechaIngreso),
              vinculos: {
                create: {
                  regimenId: datos.regimenId,
                  tipoPersonal: datos.tipoPersonal,
                  cargoId: datos.cargoId,
                  areaId: datos.areaId,
                  fechaInicio: aFecha(datos.fechaIngreso),
                  referencia: datos.referencia ?? null,
                },
              },
            },
            include: incluirDetalle,
          });
          await this.auditoria.registrar(
            {
              accion: 'TRABAJADOR_CREAR',
              entidad: 'trabajador',
              entidadId: trabajador.id,
              trabajadorId: trabajador.id,
              usuarioId: actor.usuarioId,
              cliente,
              detalle: { fechaIngreso: datos.fechaIngreso, regimenId: datos.regimenId, cargoId: datos.cargoId, areaId: datos.areaId },
            },
            transaccion,
          );
          return trabajador;
        }),
      MENSAJE_DUPLICADO,
    );
    return aDetalleDto(creado);
  }

  async editar(id: string, datos: UpdateWorkerDto, actor: SesionActiva, cliente: DatosCliente): Promise<WorkerDetailDto> {
    const actual = await this.cargar(id);
    validarDocumento(datos.tipoDocIdentidad, datos.numeroDoc);
    validarUbigeo(datos.departamento, datos.provincia, datos.distrito);
    if (datos.fechaIngreso > hoyEnLima() || (datos.fechaNacimiento !== null && datos.fechaNacimiento > hoyEnLima())) {
      throw new BadRequestException('Las fechas no pueden ser futuras');
    }
    const cambios: Prisma.TrabajadorUpdateInput = {
      tipoDocIdentidad: datos.tipoDocIdentidad,
      numeroDoc: datos.numeroDoc,
      nombres: datos.nombres,
      apellidoPaterno: datos.apellidoPaterno,
      apellidoMaterno: datos.apellidoMaterno,
      fechaNacimiento: datos.fechaNacimiento === null ? null : aFecha(datos.fechaNacimiento),
      sexo: datos.sexo,
      estadoCivil: datos.estadoCivil,
      direccion: datos.direccion,
      departamento: datos.departamento,
      provincia: datos.provincia,
      distrito: datos.distrito,
      telefono: datos.telefono,
      correo: datos.correo === null ? null : datos.correo.toLowerCase(),
      fechaIngreso: aFecha(datos.fechaIngreso),
    };
    const actualizado = await sinDuplicados(
      () =>
        this.prisma.$transaction(async (transaccion) => {
          const trabajador = await transaccion.trabajador.update({ where: { id }, data: cambios, include: incluirDetalle });
          await this.auditoria.registrar(
            {
              accion: 'TRABAJADOR_EDITAR',
              entidad: 'trabajador',
              entidadId: id,
              trabajadorId: id,
              usuarioId: actor.usuarioId,
              cliente,
              detalle: { antes: this.fichaAuditable(actual), despues: this.fichaAuditable(trabajador) },
            },
            transaccion,
          );
          return trabajador;
        }),
      MENSAJE_DUPLICADO,
    );
    return aDetalleDto(actualizado);
  }

  private async cargar(id: string): Promise<Prisma.TrabajadorGetPayload<{ include: typeof incluirDetalle }>> {
    const trabajador = await this.prisma.trabajador.findUnique({ where: { id }, include: incluirDetalle });
    if (trabajador === null) {
      throw new NotFoundException('El trabajador no existe');
    }
    return trabajador;
  }

  private filtro(consulta: WorkerQueryDto): Prisma.TrabajadorWhereInput {
    const condiciones: Prisma.TrabajadorWhereInput[] = [];
    if (consulta.estado !== undefined) {
      condiciones.push({ estado: consulta.estado });
    }
    if (consulta.movimiento !== undefined) {
      condiciones.push({ movimientoActual: consulta.movimiento });
    }
    if (consulta.areaId !== undefined || consulta.regimenId !== undefined) {
      condiciones.push({
        vinculos: { some: { actual: true, areaId: consulta.areaId, regimenId: consulta.regimenId } },
      });
    }
    const termino = consulta.busqueda ?? null;
    if (termino !== null) {
      const palabras = normalizarBusqueda(termino).split(/\s+/).filter((palabra) => palabra.length > 0);
      const documento = termino.trim().toUpperCase();
      const texto = termino.trim();
      condiciones.push({
        OR: [
          { numeroDoc: { startsWith: documento } },
          { AND: palabras.map((palabra) => ({ nombreBusqueda: { contains: palabra } })) },
          { vinculos: { some: { actual: true, cargo: { nombre: { contains: texto, mode: 'insensitive' } } } } },
          { vinculos: { some: { actual: true, area: { nombre: { contains: texto, mode: 'insensitive' } } } } },
        ],
      });
    }
    return { AND: condiciones };
  }

  private fichaAuditable(trabajador: Prisma.TrabajadorGetPayload<{ include: typeof incluirDetalle }>): Record<string, string | null> {
    return {
      documento: `${trabajador.tipoDocIdentidad} ${trabajador.numeroDoc}`,
      nombres: trabajador.nombres,
      apellidoPaterno: trabajador.apellidoPaterno,
      apellidoMaterno: trabajador.apellidoMaterno,
      fechaIngreso: aTexto(trabajador.fechaIngreso),
      direccion: trabajador.direccion,
      telefono: trabajador.telefono,
      correo: trabajador.correo,
    };
  }
}
