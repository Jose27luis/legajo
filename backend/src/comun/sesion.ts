import type { Request } from 'express';

export interface SesionActiva {
  sid: string;
  usuarioId: string;
  rol: string;
  permisos: string[];
  debeCambiarClave: boolean;
  creadaEn: string;
}

export interface SolicitudConSesion extends Request {
  sesion?: SesionActiva;
}

export const NOMBRE_COOKIE_SESION = 'legajos_sesion';
