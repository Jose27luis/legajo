import type { Prisma } from '../generated/prisma/client';
import { aTexto } from '../common/dates';

export const incluirEstadoLaboral = {
  vinculos: {
    orderBy: [{ fechaInicio: 'desc' }, { creadoEn: 'desc' }],
    include: { regimen: { select: { nombre: true } }, cargo: { select: { nombre: true } }, area: { select: { nombre: true } } },
  },
} as const satisfies Prisma.TrabajadorInclude;

export type EstadoLaboral = Prisma.TrabajadorGetPayload<{ include: typeof incluirEstadoLaboral }>;

type PeriodoLaboral = EstadoLaboral['vinculos'][number];

const TEXTO_MOTIVO_FIN: Readonly<Record<string, string>> = {
  RENUNCIA: 'renuncia',
  JUBILACION: 'jubilación',
  FALLECIMIENTO: 'fallecimiento',
  FIN_CONTRATO: 'fin de contrato',
  DESTITUCION: 'destitución',
  OTRA_CAUSA: 'otra causa',
  RENOVACION: 'renovación',
  CAMBIO_REGIMEN: 'cambio de régimen',
  CAMBIO_CARGO_O_AREA: 'cambio de cargo o área',
};

function fecha(valor: Date): string {
  const [anio, mes, dia] = aTexto(valor).split('-');
  return `${dia}/${mes}/${anio}`;
}

function descripcion(periodo: PeriodoLaboral): string {
  return `${periodo.regimen.nombre}, desde el ${fecha(periodo.fechaInicio)}`;
}

export class SimulacionLaboral extends Error {
  constructor(readonly estado: EstadoLaboral) {
    super('Simulación laboral');
  }
}

export function avisosDeCambio(antes: EstadoLaboral, despues: EstadoLaboral): string[] {
  const vigente = antes.vinculos.find((vinculo) => vinculo.actual);
  if (vigente === undefined) {
    return [];
  }
  const avisos: string[] = [];
  const luego = despues.vinculos.find((vinculo) => vinculo.id === vigente.id);
  if (luego === undefined) {
    avisos.push(`Quitará el período vigente (${descripcion(vigente)}).`);
  } else {
    if (aTexto(luego.fechaInicio) !== aTexto(vigente.fechaInicio)) {
      avisos.push(`Cambiará el inicio del período vigente del ${fecha(vigente.fechaInicio)} al ${fecha(luego.fechaInicio)}.`);
    }
    if (vigente.fechaFin === null && luego.fechaFin !== null) {
      const motivo = luego.motivoFin === null ? '' : ` por ${TEXTO_MOTIVO_FIN[luego.motivoFin] ?? luego.motivoFin.toLowerCase()}`;
      avisos.push(`Cerrará el período vigente (${descripcion(vigente)}) el ${fecha(luego.fechaFin)}${motivo}.`);
    }
    if (luego.regimenId !== vigente.regimenId) {
      avisos.push(`Cambiará el régimen del período vigente de ${vigente.regimen.nombre} a ${luego.regimen.nombre}.`);
    }
    if (luego.cargoId !== vigente.cargoId) {
      avisos.push(`Cambiará el cargo del período vigente de ${vigente.cargo.nombre} a ${luego.cargo.nombre}.`);
    }
    if (luego.areaId !== vigente.areaId) {
      avisos.push(`Cambiará el área del período vigente de ${vigente.area.nombre} a ${luego.area.nombre}.`);
    }
  }
  const existentes = new Set(antes.vinculos.map((vinculo) => vinculo.id));
  for (const nuevo of despues.vinculos) {
    if (existentes.has(nuevo.id) || aTexto(nuevo.fechaInicio) <= aTexto(vigente.fechaInicio)) {
      continue;
    }
    const hasta = nuevo.fechaFin === null ? '' : ` hasta el ${fecha(nuevo.fechaFin)}`;
    avisos.push(`Abrirá un período nuevo de ${nuevo.regimen.nombre} desde el ${fecha(nuevo.fechaInicio)}${hasta}.`);
  }
  if (aTexto(despues.fechaIngreso) !== aTexto(antes.fechaIngreso)) {
    avisos.push(`Cambiará la fecha de ingreso del trabajador del ${fecha(antes.fechaIngreso)} al ${fecha(despues.fechaIngreso)}.`);
  }
  if (antes.estado === 'ACTIVO' && despues.estado === 'CESADO') {
    avisos.push('El trabajador quedará CESADO.');
  }
  return avisos;
}
