import { HttpErrorResponse } from '@angular/common/http';

export function mensajeDeError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'No se pudo completar la acción. Intenta de nuevo.';
  }
  if (error.status === 0) {
    return 'No hay conexión con el servidor. Revisa tu red e intenta de nuevo.';
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo) {
    const mensaje: unknown = cuerpo.message;
    if (typeof mensaje === 'string') {
      return mensaje;
    }
    if (Array.isArray(mensaje) && typeof mensaje[0] === 'string') {
      return mensaje[0];
    }
  }
  if (error.status >= 500) {
    return 'El servidor no pudo atender la solicitud. Intenta de nuevo en unos minutos.';
  }
  return 'No se pudo completar la acción. Intenta de nuevo.';
}
