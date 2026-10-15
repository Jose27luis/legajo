import { fechaHora, normalizarTexto } from '../../src/app/core/format';

describe('normalizarTexto', () => {
  it('quita tildes, pasa a minúsculas y recorta espacios', () => {
    expect(normalizarTexto('  Área de PERSONAL  ')).toBe('area de personal');
    expect(normalizarTexto('Resolución Ñandú')).toBe('resolucion nandu');
  });
});

describe('fechaHora', () => {
  it('muestra Nunca cuando no hay fecha', () => {
    expect(fechaHora(null)).toBe('Nunca');
  });

  it('expresa la hora en Lima', () => {
    expect(fechaHora('2026-10-14T05:30:00Z')).toContain('12:30');
  });
});
