import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { SessionService } from './session.service';

export const autenticadoGuard: CanMatchFn = async () => {
  const sesion = inject(SessionService);
  const router = inject(Router);
  const usuario = await sesion.asegurar();
  return usuario === null ? router.createUrlTree(['/login']) : true;
};

export const claveAlDiaGuard: CanMatchFn = () => {
  const sesion = inject(SessionService);
  const router = inject(Router);
  return sesion.usuario()?.debeCambiarClave === true ? router.createUrlTree(['/change-password']) : true;
};

export function permisoGuard(permiso: string): CanMatchFn {
  return () => {
    const sesion = inject(SessionService);
    const router = inject(Router);
    return sesion.tiene(permiso) ? true : router.createUrlTree(['/']);
  };
}

export const invitadoGuard: CanMatchFn = async () => {
  const sesion = inject(SessionService);
  const router = inject(Router);
  const usuario = await sesion.asegurar();
  return usuario === null ? true : router.createUrlTree(['/']);
};
