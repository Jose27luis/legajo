import { marcadoDe, numeroDe, valorDe } from '../../src/app/core/inputs';

function eventoDe(elemento: EventTarget): Event {
  const evento = new Event('change');
  elemento.dispatchEvent(evento);
  return evento;
}

function entrada(valor: string): HTMLInputElement {
  const elemento = document.createElement('input');
  elemento.value = valor;
  return elemento;
}

describe('lectura de eventos', () => {
  it('lee el valor de una entrada', () => {
    expect(valorDe(eventoDe(entrada('abc')))).toBe('abc');
  });

  it('convierte a número o null cuando está vacío', () => {
    expect(numeroDe(eventoDe(entrada('42')))).toBe(42);
    expect(numeroDe(eventoDe(entrada('')))).toBeNull();
  });

  it('lee si una casilla está marcada', () => {
    const casilla = document.createElement('input');
    casilla.type = 'checkbox';
    casilla.checked = true;
    expect(marcadoDe(eventoDe(casilla))).toBe(true);
  });

  it('devuelve vacío cuando el evento no viene de un campo', () => {
    expect(valorDe(eventoDe(document.createElement('div')))).toBe('');
  });
});
