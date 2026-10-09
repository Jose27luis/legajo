import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { datosCliente } from '../comun/cliente';
import { CLAVE_CLAVE_PENDIENTE, CLAVE_PERMISOS, CLAVE_PUBLICO } from '../comun/decoradores';
import { NOMBRE_COOKIE_SESION, type SolicitudConSesion } from '../comun/sesion';
import { SesionService } from './sesion.service';

const METODOS_QUE_MODIFICAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CABECERA_ANTI_CSRF = 'x-legajos';

@Injectable()
export class SesionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sesiones: SesionService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const solicitud = contexto.switchToHttp().getRequest<SolicitudConSesion>();
    const objetivos = [contexto.getHandler(), contexto.getClass()];

    if (METODOS_QUE_MODIFICAN.has(solicitud.method) && solicitud.headers[CABECERA_ANTI_CSRF] !== '1') {
      throw new ForbiddenException('Solicitud no permitida');
    }

    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos) === true) {
      return true;
    }

    const cookies: Record<string, unknown> = solicitud.cookies ?? {};
    const sid = cookies[NOMBRE_COOKIE_SESION];
    const sesion = typeof sid === 'string' ? await this.sesiones.obtener(sid) : null;
    if (sesion === null) {
      throw new UnauthorizedException('Tu sesión terminó. Vuelve a iniciar sesión.');
    }
    solicitud.sesion = sesion;

    const permiteClavePendiente = this.reflector.getAllAndOverride<boolean>(CLAVE_CLAVE_PENDIENTE, objetivos) === true;
    if (sesion.debeCambiarClave && !permiteClavePendiente) {
      throw new ForbiddenException('Debes cambiar tu contraseña antes de continuar');
    }

    const requeridos = this.reflector.getAllAndOverride<string[] | undefined>(CLAVE_PERMISOS, objetivos) ?? [];
    const faltantes = requeridos.filter((permiso) => !sesion.permisos.includes(permiso));
    if (faltantes.length > 0) {
      await this.auditoria.registrar({
        accion: 'ACCESO_DENEGADO',
        entidad: 'ruta',
        entidadId: null,
        usuarioId: sesion.usuarioId,
        cliente: datosCliente(solicitud),
        detalle: { permisosFaltantes: faltantes },
      });
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return true;
  }
}
