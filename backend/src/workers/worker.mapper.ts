import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { aTexto, aTextoOpcional } from '../common/dates';
import type { SesionActiva } from '../common/session';
import { filtroVisibilidad } from '../documents/document.mapper';
import { finDeContrato } from '../labor/contract-expiry.service';
import { UBIGEO_PERU } from '../ubigeo-catalog';
import type {
  LinkDto,
  MovementDto,
  RelativeDto,
  WorkerDetailDto,
  WorkerDirectoryItemDto,
  WorkerListItemDto,
} from './dto/worker.dto';

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
  vinculos: {
    include: {
      ...incluirVinculo,
      documentos: { where: { estado: { not: 'ANULADO' }, tipoDocumento: { accion: 'VINCULO' } }, select: { datos: true } },
    },
    orderBy: [{ fechaInicio: 'desc' }, { creadoEn: 'desc' }],
  },
  familiares: { orderBy: { creadoEn: 'asc' } },
  movimientos: {
    include: { areaOrigen: true, areaDestino: true, creadoPor: { select: { nombreCompleto: true } } },
    orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
  },
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
  const actual = trabajador.vinculos.find((vinculo) => vinculo.actual);
  return {
    ...base(trabajador, actual),
    finContrato: actual === undefined || actual.fechaFin !== null ? null : finDeContrato(actual.documentos),
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
    movimientos: trabajador.movimientos.map(aMovimientoDto),
  };
}

export function aMovimientoDto(movimiento: TrabajadorDetalle['movimientos'][number]): MovementDto {
  return {
    id: movimiento.id,
    tipo: movimiento.tipo,
    fecha: aTexto(movimiento.fecha),
    areaOrigen: { id: movimiento.areaOrigen.id, nombre: movimiento.areaOrigen.nombre },
    areaDestino: { id: movimiento.areaDestino.id, nombre: movimiento.areaDestino.nombre },
    documentoId: movimiento.documentoId,
    observacion: movimiento.observacion,
    registradoPor: movimiento.creadoPor.nombreCompleto,
    registradoEn: movimiento.creadoEn.toISOString(),
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

export function validarUbigeo(departamento: string | null, provincia: string | null, distrito: string | null): void {
  if (departamento === null) {
    if (provincia !== null || distrito !== null) {
      throw new BadRequestException('Elige el departamento antes de la provincia y el distrito');
    }
    return;
  }
  const lugar = UBIGEO_PERU.find((item) => item.nombre === departamento);
  if (lugar === undefined) {
    throw new BadRequestException('El departamento no existe en el Perú');
  }
  if (provincia === null) {
    if (distrito !== null) {
      throw new BadRequestException('Elige la provincia antes del distrito');
    }
    return;
  }
  const zona = lugar.provincias.find((item) => item.nombre === provincia);
  if (zona === undefined) {
    throw new BadRequestException(`La provincia no pertenece a ${departamento}`);
  }
  if (distrito !== null && !zona.distritos.includes(distrito)) {
    throw new BadRequestException(`El distrito no pertenece a la provincia de ${provincia}`);
  }
}
