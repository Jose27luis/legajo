import type { EstadoTrabajador, MotivoCambio, MotivoCese, MotivoFin, Movimiento, TipoPersonal, TrabajadorResumen } from './models';

export const TEXTO_ESTADO: Record<EstadoTrabajador, string> = {
  ACTIVO: 'Activo',
  CESADO: 'Cesado',
};

export const TEXTO_MOVIMIENTO: Record<Movimiento, string> = {
  SIN_MOVIMIENTO: 'Sin movimiento',
  ROTACION: 'Rotación',
  DESTAQUE: 'Destaque',
  ENCARGATURA: 'Encargatura',
  REASIGNACION: 'Reasignación',
};

export const TEXTO_MOTIVO_CESE: Record<MotivoCese, string> = {
  RENUNCIA: 'Renuncia',
  JUBILACION: 'Jubilación',
  FALLECIMIENTO: 'Fallecimiento',
  FIN_CONTRATO: 'Fin de contrato',
  DESTITUCION: 'Destitución',
  OTRA_CAUSA: 'Otra causa',
};

export const TEXTO_MOTIVO_CAMBIO: Record<MotivoCambio, string> = {
  RENOVACION: 'Renovación',
  CAMBIO_REGIMEN: 'Cambio de régimen',
  CAMBIO_CARGO_O_AREA: 'Cambio de cargo o área',
};

export const TEXTO_MOTIVO_FIN: Record<MotivoFin, string> = { ...TEXTO_MOTIVO_CESE, ...TEXTO_MOTIVO_CAMBIO };

export const TEXTO_TIPO_PERSONAL: Record<TipoPersonal, string> = {
  ADMINISTRATIVO: 'Administrativo',
  ASISTENCIAL: 'Asistencial',
};

export const MOVIMIENTOS: readonly Movimiento[] = ['SIN_MOVIMIENTO', 'ROTACION', 'DESTAQUE', 'ENCARGATURA', 'REASIGNACION'];
export const MOTIVOS_CESE: readonly MotivoCese[] = ['RENUNCIA', 'JUBILACION', 'FALLECIMIENTO', 'FIN_CONTRATO', 'DESTITUCION', 'OTRA_CAUSA'];
export const MOTIVOS_CAMBIO: readonly MotivoCambio[] = ['RENOVACION', 'CAMBIO_REGIMEN', 'CAMBIO_CARGO_O_AREA'];

export function nombreCompleto(trabajador: Pick<TrabajadorResumen, 'nombres' | 'apellidoPaterno' | 'apellidoMaterno'>): string {
  const apellidos = [trabajador.apellidoPaterno, trabajador.apellidoMaterno].filter((parte) => parte !== null && parte !== '');
  return `${apellidos.join(' ')}, ${trabajador.nombres}`;
}

export function iniciales(trabajador: Pick<TrabajadorResumen, 'nombres' | 'apellidoPaterno'>): string {
  return `${trabajador.nombres.charAt(0)}${trabajador.apellidoPaterno.charAt(0)}`.toUpperCase();
}

export function puedeReingresar(trabajador: TrabajadorResumen): boolean {
  return trabajador.estado === 'CESADO' && trabajador.vinculo?.motivoFin !== 'FALLECIMIENTO';
}

const formatoFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' });

export function fechaCorta(valor: string | null): string {
  return valor === null ? 'No registrada' : formatoFecha.format(new Date(`${valor}T00:00:00Z`));
}

export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
}
