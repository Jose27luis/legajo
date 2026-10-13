export const COLA_RESPALDOS = 'respaldos';
export const TRABAJO_PROGRAMADO = 'backup-programado';
export const TRABAJO_MANUAL = 'backup-manual';
export const CLAVE_RESUMEN = 'respaldo:resumen';

export interface TrabajoRespaldo {
  usuarioId: string | null;
}

export interface SnapshotResumen {
  id: string;
  fecha: string;
  etiquetas: string[];
  rutas: string[];
}

export interface ResumenRepositorio {
  actualizado: string;
  espacio: number;
  snapshots: SnapshotResumen[];
}
