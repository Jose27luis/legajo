import type {
  Documento,
  EstadoDocumento,
  EstadoItemLote,
  EstadoLote,
  EstadoTrabajador,
  MotivoCambio,
  MotivoCese,
  MotivoFin,
  Movimiento,
  NivelAcceso,
  SituacionCelda,
  TipoPersonal,
  TrabajadorResumen,
  Vinculo,
} from './models';

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
  DESIGNACION: 'Designación',
  CAMBIO_FUNCIONES: 'Cambio de funciones',
  OTRO: 'Otro',
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

export const MOVIMIENTOS: readonly Movimiento[] = [
  'SIN_MOVIMIENTO',
  'ROTACION',
  'DESTAQUE',
  'ENCARGATURA',
  'REASIGNACION',
  'DESIGNACION',
  'CAMBIO_FUNCIONES',
  'OTRO',
];
export const MOVIMIENTOS_REALES = MOVIMIENTOS.filter(
  (movimiento): movimiento is Exclude<Movimiento, 'SIN_MOVIMIENTO'> => movimiento !== 'SIN_MOVIMIENTO',
);
export const MOTIVOS_CESE: readonly MotivoCese[] = ['RENUNCIA', 'JUBILACION', 'FALLECIMIENTO', 'FIN_CONTRATO', 'DESTITUCION', 'OTRA_CAUSA'];
export const MOTIVOS_CAMBIO: readonly MotivoCambio[] = ['RENOVACION', 'CAMBIO_REGIMEN', 'CAMBIO_CARGO_O_AREA'];

export function esSalidaDocumentada(
  vinculo: Pick<Vinculo, 'id' | 'motivoFin'>,
  documentos: readonly Pick<Documento, 'vinculoId' | 'seccion' | 'estado'>[],
): boolean {
  if (vinculo.motivoFin === null || !MOTIVOS_CESE.some((motivo) => motivo === vinculo.motivoFin)) {
    return false;
  }
  if (vinculo.motivoFin !== 'FIN_CONTRATO') {
    return true;
  }
  return documentos.some((documento) => documento.vinculoId === vinculo.id && documento.seccion === 11 && documento.estado !== 'ANULADO');
}

export const CODIGO_RENUNCIA = '1109';

export function renunciaDelPeriodo(vinculo: Pick<Vinculo, 'id' | 'fechaFin'>, documentos: readonly Documento[]): Documento | null {
  return (
    documentos.find(
      (documento) =>
        documento.seccion === 11 &&
        documento.tipo.codigo === CODIGO_RENUNCIA &&
        documento.estado !== 'ANULADO' &&
        periodoDeLaRenuncia(documento, documentos, vinculo),
    ) ?? null
  );
}

function periodoDeLaRenuncia(renuncia: Documento, documentos: readonly Documento[], vinculo: Pick<Vinculo, 'id' | 'fechaFin'>): boolean {
  if (renuncia.vinculoId !== null) {
    return renuncia.vinculoId === vinculo.id;
  }
  const contratoId = textoDato(renuncia, 'contratoRelacionado');
  const periodoContrato = documentos.find((documento) => documento.id === contratoId)?.vinculoId ?? null;
  return periodoContrato === null ? vinculo.fechaFin === null : periodoContrato === vinculo.id;
}

export function textoDato(documento: Pick<Documento, 'datos'>, clave: string): string | null {
  const valor = documento.datos[clave];
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

export function fechaRenuncia(documento: Documento, vinculo: Pick<Vinculo, 'fechaFin'>): string | null {
  return textoDato(documento, 'fechaCese') ?? vinculo.fechaFin ?? textoDato(documento, 'fechaPresentacion') ?? documento.fechaEmision;
}

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

export const TEXTO_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  PROCESANDO: 'Procesando',
  DISPONIBLE: 'Registrado',
  ERROR: 'Con error',
  ANULADO: 'Anulado',
};

export const CLASE_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  PROCESANDO: 'azul',
  DISPONIBLE: 'verde',
  ERROR: 'roja',
  ANULADO: 'gris',
};

export const TEXTO_NIVEL_ACCESO: Record<NivelAcceso, string> = {
  NORMAL: 'Normal',
  RESTRINGIDO: 'Restringido',
  MUY_RESTRINGIDO: 'Muy restringido',
};

export const ESTADOS_DOCUMENTO: readonly EstadoDocumento[] = ['DISPONIBLE', 'PROCESANDO', 'ERROR', 'ANULADO'];
export const NIVELES_ACCESO: readonly NivelAcceso[] = ['NORMAL', 'RESTRINGIDO', 'MUY_RESTRINGIDO'];

export function numeroSeccion(numero: number): string {
  return String(numero).padStart(2, '0');
}

export const CLASE_MOVIMIENTO: Record<Movimiento, string> = {
  SIN_MOVIMIENTO: 'gris',
  ROTACION: 'violeta',
  DESTAQUE: 'turquesa',
  ENCARGATURA: 'ambar',
  REASIGNACION: 'azul',
  DESIGNACION: 'azul',
  CAMBIO_FUNCIONES: 'turquesa',
  OTRO: 'gris',
};

const TONOS_SECCION: readonly string[] = [
  '#1c65a0',
  '#12805c',
  '#6a4fc4',
  '#a86a10',
  '#0e8487',
  '#b8571c',
  '#3f5fc9',
  '#b23a48',
  '#58731a',
  '#c0306f',
  '#5b6b7c',
  '#7a5230',
];

export function tonoSeccion(numero: number): string {
  return TONOS_SECCION[(numero - 1) % TONOS_SECCION.length] ?? TONOS_SECCION[0];
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export const TEXTO_ESTADO_LOTE: Record<EstadoLote, string> = {
  SUBIENDO: 'Subiendo',
  EN_BANDEJA: 'En bandeja',
  TERMINADO: 'Terminado',
};

export const CLASE_ESTADO_LOTE: Record<EstadoLote, string> = {
  SUBIENDO: 'azul',
  EN_BANDEJA: 'ambar',
  TERMINADO: 'verde',
};

export const TEXTO_ESTADO_ITEM: Record<EstadoItemLote, string> = {
  SUBIENDO: 'Subiendo',
  PENDIENTE: 'Pendiente',
  CLASIFICADO: 'Clasificado',
  DIVIDIDO: 'Dividido',
  ERROR: 'Descartado',
};

export const CLASE_ESTADO_ITEM: Record<EstadoItemLote, string> = {
  SUBIENDO: 'azul',
  PENDIENTE: 'ambar',
  CLASIFICADO: 'verde',
  DIVIDIDO: 'verde',
  ERROR: 'gris',
};

export const ESTADOS_ITEM: readonly EstadoItemLote[] = ['PENDIENTE', 'CLASIFICADO', 'DIVIDIDO', 'ERROR', 'SUBIENDO'];

export const TEXTO_SITUACION: Record<SituacionCelda, string> = {
  COMPLETO: 'Completo',
  FALTANTE: 'Faltante',
  VENCIDO: 'Vencido',
  NO_APLICA: 'No aplica',
};

export const CLASE_SITUACION: Record<SituacionCelda, string> = {
  COMPLETO: 'verde',
  FALTANTE: 'roja',
  VENCIDO: 'ambar',
  NO_APLICA: 'gris',
};

export function diasRestantes(dias: number): string {
  const absoluto = Math.abs(dias);
  const plural = absoluto === 1 ? 'día' : 'días';
  if (dias < 0) {
    return `Venció hace ${absoluto} ${plural}`;
  }
  if (dias === 0) {
    return 'Vence hoy';
  }
  return `Faltan ${absoluto} ${plural}`;
}
