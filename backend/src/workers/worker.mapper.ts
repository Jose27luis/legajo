import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { aTexto, aTextoOpcional } from '../common/dates';
import type { SesionActiva } from '../common/session';
import { filtroVisibilidad } from '../documents/document.mapper';
import type { LinkDto, RelativeDto, WorkerDetailDto, WorkerDirectoryItemDto, WorkerListItemDto } from './dto/worker.dto';

export const incluirVinculo = { regimen: true, cargo: true, area: true } as const;

export const incluirListado = {
  vinculos: { where: { actual: true }, include: incluirVinculo, take: 1 },
} as const;

export function incluirDirectorio(sesion: SesionActiva) {
  return {
    vinculos: { where: { actual: true }, include: incluirVinculo, take: 1 },
    _count: { select: { documentos: { where: { estado: 'DISPONIBLE', ...filtroVisibilidad(sesion) } } } },
  } as const satisfies Prisma.TrabajadorInclude;
}

export const incluirDetalle = {
  vinculos: { include: incluirVinculo, orderBy: [{ fechaInicio: 'desc' }, { creadoEn: 'desc' }] },
  familiares: { orderBy: { creadoEn: 'asc' } },
} as const satisfies Prisma.TrabajadorInclude;

type VinculoCompleto = Prisma.VinculoGetPayload<{ include: typeof incluirVinculo }>;
type TrabajadorListado = Prisma.TrabajadorGetPayload<{ include: typeof incluirListado }>;
export type TrabajadorDetalle = Prisma.TrabajadorGetPayload<{ include: typeof incluirDetalle }>;

export function aVinculoDto(vinculo: VinculoCompleto): LinkDto {
  return {
    id: vinculo.id,
    regimen: { id: vinculo.regimen.id, nombre: vinculo.regimen.nombre },
    tipoPersonal: vinculo.tipoPersonal,
    cargo: { id: vinculo.cargo.id, nombre: vinculo.cargo.nombre },
    area: { id: vinculo.area.id, nombre: vinculo.area.nombre },
    fechaInicio: aTexto(vinculo.fechaInicio),
    fechaFin: aTextoOpcional(vinculo.fechaFin),
    motivoFin: vinculo.motivoFin,
    referencia: vinculo.referencia,
    actual: vinculo.actual,
  };
}

function base(trabajador: TrabajadorListado | TrabajadorDetalle, vinculo: VinculoCompleto | undefined): WorkerListItemDto {
  return {
    id: trabajador.id,
    tipoDocIdentidad: trabajador.tipoDocIdentidad,
    numeroDoc: trabajador.numeroDoc,
    nombres: trabajador.nombres,
    apellidoPaterno: trabajador.apellidoPaterno,
    apellidoMaterno: trabajador.apellidoMaterno,
    estado: trabajador.estado,
    movimientoActual: trabajador.movimientoActual,
    movimientoFecha: aTextoOpcional(trabajador.movimientoFecha),
    fechaIngreso: aTexto(trabajador.fechaIngreso),
    vinculo: vinculo === undefined ? null : aVinculoDto(vinculo),
  };
}

export function aListadoDto(trabajador: TrabajadorListado): WorkerListItemDto {
  return base(trabajador, trabajador.vinculos[0]);
}

export function aDirectorioDto(trabajador: TrabajadorListado & { _count: { documentos: number } }): WorkerDirectoryItemDto {
  return { ...base(trabajador, trabajador.vinculos[0]), documentos: trabajador._count.documentos };
}

export function aFamiliarDto(familiar: TrabajadorDetalle['familiares'][number]): RelativeDto {
  return {
    id: familiar.id,
    parentesco: familiar.parentesco,
    nombresApellidos: familiar.nombresApellidos,
    numeroDoc: familiar.numeroDoc,
    fechaNacimiento: aTextoOpcional(familiar.fechaNacimiento),
  };
}

export function aDetalleDto(trabajador: TrabajadorDetalle): WorkerDetailDto {
  return {
    ...base(
      trabajador,
      trabajador.vinculos.find((vinculo) => vinculo.actual),
    ),
    fechaNacimiento: aTextoOpcional(trabajador.fechaNacimiento),
    sexo: trabajador.sexo,
    estadoCivil: trabajador.estadoCivil,
    direccion: trabajador.direccion,
    departamento: trabajador.departamento,
    provincia: trabajador.provincia,
    distrito: trabajador.distrito,
    telefono: trabajador.telefono,
    correo: trabajador.correo,
    creadoEn: trabajador.creadoEn.toISOString(),
    vinculos: trabajador.vinculos.map(aVinculoDto),
    familiares: trabajador.familiares.map(aFamiliarDto),
  };
}

export function validarDocumento(tipo: 'DNI' | 'CE', numero: string): void {
  if (tipo === 'DNI' && !/^[0-9]{8}$/.test(numero)) {
    throw new BadRequestException('El DNI debe tener 8 dígitos');
  }
  if (tipo === 'CE' && !/^[A-Z0-9]{9,12}$/.test(numero)) {
    throw new BadRequestException('El carné de extranjería debe tener de 9 a 12 caracteres');
  }
}
