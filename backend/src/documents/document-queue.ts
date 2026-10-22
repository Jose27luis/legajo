export const COLA_DOCUMENTOS = 'documentos';
export const TRABAJO_PROCESAR = 'procesar-documento';
export const TRABAJO_LIMPIAR = 'limpiar-subidas';
export const TRABAJO_ELIMINAR = 'eliminar-archivos';

export interface TrabajoProcesar {
  documentoId: string;
  subidaId: string;
  nombreOriginal: string;
  usuarioId: string;
}

export interface TrabajoEliminar {
  trabajadorId: string;
  documentoId: string;
}

export type TrabajoDocumentos = TrabajoProcesar | TrabajoEliminar;

export function esProcesar(trabajo: TrabajoDocumentos): trabajo is TrabajoProcesar {
  return 'subidaId' in trabajo;
}

export interface ConexionRedis {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: null;
}

export function conexionRedis(url: string): ConexionRedis {
  const direccion = new URL(url);
  const base = direccion.pathname.replace('/', '');
  return {
    host: direccion.hostname,
    port: direccion.port === '' ? 6379 : Number(direccion.port),
    ...(direccion.password === '' ? {} : { password: decodeURIComponent(direccion.password) }),
    db: base === '' ? 0 : Number(base),
    maxRetriesPerRequest: null,
  };
}

export function rutaSubida(directorio: string, subidaId: string): string {
  return `${directorio}/${subidaId}`;
}

export const FORMATO_SUBIDA = /^[a-f0-9]{32}$/;
