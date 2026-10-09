import { createParamDecorator, ExecutionContext, SetMetadata, UnauthorizedException } from '@nestjs/common';
import type { SesionActiva, SolicitudConSesion } from './session';

export const CLAVE_PUBLICO = 'legajos:publico';
export const CLAVE_PERMISOS = 'legajos:permisos';
export const CLAVE_CLAVE_PENDIENTE = 'legajos:clave-pendiente';

export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

export const Requiere = (...permisos: string[]) => SetMetadata(CLAVE_PERMISOS, permisos);

export const PermiteClavePendiente = () => SetMetadata(CLAVE_CLAVE_PENDIENTE, true);

export const SesionActual = createParamDecorator((_: unknown, contexto: ExecutionContext): SesionActiva => {
  const solicitud = contexto.switchToHttp().getRequest<SolicitudConSesion>();
  if (solicitud.sesion === undefined) {
    throw new UnauthorizedException('Sesión no válida');
  }
  return solicitud.sesion;
});
