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
