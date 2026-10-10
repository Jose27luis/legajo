export interface UsuarioSesion {
  id: string;
  usuario: string;
  nombreCompleto: string;
  correo: string;
  rol: string;
  permisos: string[];
  debeCambiarClave: boolean;
  ultimoAcceso: string | null;
}

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface Usuario {
  id: string;
  usuario: string;
  nombreCompleto: string;
  correo: string;
  rol: { id: string; nombre: string };
  activo: boolean;
  bloqueadoHasta: string | null;
  debeCambiarClave: boolean;
  ultimoAcceso: string | null;
  creadoEn: string;
}

export interface ClaveTemporal {
  usuario: Usuario;
  claveTemporal: string;
}

export interface DatosUsuario {
  nombreCompleto: string;
  correo: string;
  rolId: string;
}

export interface NuevoUsuario extends DatosUsuario {
  usuario: string;
}

export type TipoCampo = 'texto' | 'fecha' | 'numero' | 'seleccion' | 'parrafo';

export interface CampoSeccion {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  obligatorio: boolean;
}

export interface TipoDocumento {
  id: number;
  seccionId: number;
  codigo: string;
  nombre: string;
  restringido: boolean;
  requiereNumero: boolean;
  tieneVencimiento: boolean;
  activo: boolean;
  orden: number;
}

export interface Seccion {
  id: number;
  numero: number;
  nombre: string;
  carpeta: string;
  descripcion: string;
  campos: CampoSeccion[];
  tipos: TipoDocumento[];
}

export interface DatosTipoDocumento {
  nombre: string;
  restringido: boolean;
  requiereNumero: boolean;
  tieneVencimiento: boolean;
}

export interface Regimen {
  id: number;
  codigo: string;
  nombre: string;
  esLaboral: boolean;
  activo: boolean;
}

export interface Area {
  id: number;
  nombre: string;
  padreId: number | null;
  padreNombre: string | null;
  activo: boolean;
}

export interface Cargo {
  id: number;
  nombre: string;
  activo: boolean;
}

export type TipoPersonal = 'ADMINISTRATIVO' | 'ASISTENCIAL';
export type AplicaA = 'ACTIVO' | 'CESADO' | 'TODOS';

export interface Requisito {
  id: number;
  tipoDocumento: TipoDocumento;
  regimen: Regimen | null;
  tipoPersonal: TipoPersonal | null;
  aplicaA: AplicaA;
}

export interface NuevoRequisito {
  tipoDocumentoId: number;
  regimenId: number | null;
  tipoPersonal: TipoPersonal | null;
  aplicaA: AplicaA;
}
