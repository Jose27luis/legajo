import { HttpErrorResponse } from '@angular/common/http';
import { mensajeDeError } from '../../src/app/core/errors';

describe('mensajeDeError', () => {
  it('usa el mensaje del servidor cuando es texto', () => {
    const error = new HttpErrorResponse({ status: 400, error: { message: 'El DNI debe tener 8 dígitos' } });
    expect(mensajeDeError(error)).toBe('El DNI debe tener 8 dígitos');
  });

  it('usa el primer mensaje cuando el servidor envía una lista', () => {
    const error = new HttpErrorResponse({ status: 400, error: { message: ['Primero', 'Segundo'] } });
    expect(mensajeDeError(error)).toBe('Primero');
  });

  it('avisa la falta de conexión', () => {
    expect(mensajeDeError(new HttpErrorResponse({ status: 0 }))).toContain('No hay conexión');
  });

  it('da un mensaje propio para fallas del servidor sin detalle', () => {
    expect(mensajeDeError(new HttpErrorResponse({ status: 502, error: 'Bad Gateway' }))).toContain('El servidor no pudo');
  });

  it('da un mensaje genérico para errores que no son HTTP', () => {
    expect(mensajeDeError(new Error('x'))).toBe('No se pudo completar la acción. Intenta de nuevo.');
  });
});
