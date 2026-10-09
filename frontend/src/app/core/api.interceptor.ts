import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SesionService } from './sesion.service';

const RUTAS_SIN_REDIRECCION = ['/api/auth/login', '/api/auth/me'];

export const apiInterceptor: HttpInterceptorFn = (solicitud, siguiente) => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  const preparada = solicitud.clone({ withCredentials: true, setHeaders: { 'X-Legajos': '1' } });

  return siguiente(preparada).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !RUTAS_SIN_REDIRECCION.some((ruta) => solicitud.url.endsWith(ruta))
      ) {
        sesion.limpiar();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
