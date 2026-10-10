import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aFecha, aTexto, hoyEnLima, normalizarBusqueda } from '../common/dates';
import { sinDuplicados } from '../common/unique-violation';
import type { CreateWorkerDto, LookupQueryDto, UpdateWorkerDto, WorkerQueryDto } from './dto/worker-input.dto';
import type { WorkerDetailDto, WorkerLookupDto, WorkerPageDto, WorkerSummaryDto } from './dto/worker.dto';
import { exigirCatalogosActivos } from './catalog-guard';
import { aDetalleDto, aListadoDto, incluirDetalle, incluirListado, validarDocumento } from './worker.mapper';

const MENSAJE_DUPLICADO = 'Ya existe un trabajador registrado con ese documento';
const LIMITE_EXPORTACION = 10000;
const MARCA_UTF8 = String.fromCharCode(0xfeff);

const TEXTO_ESTADO = { ACTIVO: 'Activo', CESADO: 'Cesado' } as const;
const TEXTO_MOVIMIENTO = {
  SIN_MOVIMIENTO: 'Sin movimiento',
  ROTACION: 'Rotación',
  DESTAQUE: 'Destaque',
  ENCARGATURA: 'Encargatura',
  REASIGNACION: 'Reasignación',
} as const;
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

  async listar(consulta: WorkerQueryDto): Promise<WorkerPageDto> {
    const pagina = consulta.pagina ?? 1;
    const porPagina = consulta.porPagina ?? 25;
    const where = this.filtro(consulta);
    const [total, trabajadores] = await this.prisma.$transaction([
      this.prisma.trabajador.count({ where }),
      this.prisma.trabajador.findMany({
        where,
        include: incluirListado,
        orderBy: [{ apellidoPaterno: 'asc' }, { apellidoMaterno: 'asc' }, { nombres: 'asc' }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
    ]);
    return { items: trabajadores.map(aListadoDto), total, pagina, porPagina };
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

  async exportar(consulta: WorkerQueryDto): Promise<string> {
    const trabajadores = await this.prisma.trabajador.findMany({
      where: this.filtro(consulta),
      include: incluirListado,
      orderBy: [{ apellidoPaterno: 'asc' }, { apellidoMaterno: 'asc' }, { nombres: 'asc' }],
      take: LIMITE_EXPORTACION,
    });
    const encabezado = [
      'Documento',
      'Apellido paterno',
      'Apellido materno',
      'Nombres',
      'Cargo',
      'Área',
      'Régimen',
      'Tipo de personal',
      'Estado laboral',
      'Motivo de cese',
      'Fecha de cese',
      'Último movimiento',
      'Fecha de ingreso',
    ];
    const filas = trabajadores.map((trabajador) => {
      const vinculo = trabajador.vinculos[0];
      const cesado = trabajador.estado === 'CESADO';
      return [
        `${trabajador.tipoDocIdentidad} ${trabajador.numeroDoc}`,
        trabajador.apellidoPaterno,
        trabajador.apellidoMaterno ?? '',
        trabajador.nombres,
        vinculo?.cargo.nombre ?? '',
        vinculo?.area.nombre ?? '',
        vinculo?.regimen.nombre ?? '',
        vinculo === undefined ? '' : vinculo.tipoPersonal === 'ADMINISTRATIVO' ? 'Administrativo' : 'Asistencial',
        TEXTO_ESTADO[trabajador.estado],
        cesado && vinculo?.motivoFin ? TEXTO_MOTIVO[vinculo.motivoFin] : '',
        cesado && vinculo?.fechaFin ? aTexto(vinculo.fechaFin) : '',
        TEXTO_MOVIMIENTO[trabajador.movimientoActual],
        aTexto(trabajador.fechaIngreso),
      ];
    });
    const csv = [encabezado, ...filas]
      .map((fila) => fila.map((valor) => `"${valor.replaceAll('"', '""')}"`).join(';'))
      .join('\r\n');
    return `${MARCA_UTF8}${csv}`;
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
      condiciones.push({
        OR: [
          { numeroDoc: { startsWith: documento } },
          { AND: palabras.map((palabra) => ({ nombreBusqueda: { contains: palabra } })) },
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
