import type { MotivoCeseValor, MovimientoValor } from './dto/worker.dto';

export const TEXTO_MOVIMIENTO: Readonly<Record<MovimientoValor, string>> = {
  SIN_MOVIMIENTO: 'Sin movimiento',
  ROTACION: 'Rotación',
  DESTAQUE: 'Destaque',
  ENCARGATURA: 'Encargatura',
  REASIGNACION: 'Reasignación',
  DESIGNACION: 'Designación',
  CAMBIO_FUNCIONES: 'Cambio de funciones',
  OTRO: 'Otro',
};

export const TEXTO_MOTIVO_CESE: Readonly<Record<MotivoCeseValor, string>> = {
  RENUNCIA: 'Renuncia',
  JUBILACION: 'Jubilación',
  FALLECIMIENTO: 'Fallecimiento',
  FIN_CONTRATO: 'Fin de contrato',
  DESTITUCION: 'Destitución',
  OTRA_CAUSA: 'Otra causa',
};

export function movimientoDeTexto(texto: string): MovimientoValor | null {
  const encontrado = Object.entries(TEXTO_MOVIMIENTO).find(([clave, etiqueta]) => etiqueta === texto && clave !== 'SIN_MOVIMIENTO');
  return encontrado === undefined ? null : (encontrado[0] as MovimientoValor);
}
