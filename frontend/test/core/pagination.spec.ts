import { signal } from '@angular/core';
import { paginar } from '../../src/app/core/pagination';

describe('paginar', () => {
  it('reparte la lista en páginas y muestra solo la página elegida', () => {
    const lista = signal(Array.from({ length: 12 }, (_, indice) => indice + 1));
    const paginacion = paginar(lista, 5, () => 'a');
    expect(paginacion.paginas()).toBe(3);
    expect(paginacion.total()).toBe(12);
    expect(paginacion.visibles()).toEqual([1, 2, 3, 4, 5]);

    paginacion.ir(3);
    expect(paginacion.visibles()).toEqual([11, 12]);
  });

  it('vuelve a la primera página cuando cambia el reinicio', () => {
    const lista = signal(Array.from({ length: 12 }, (_, indice) => indice + 1));
    const filtro = signal('');
    const paginacion = paginar(lista, 5, () => filtro());
    paginacion.ir(2);
    expect(paginacion.pagina()).toBe(2);

    filtro.set('x');
    expect(paginacion.pagina()).toBe(1);
  });

  it('no se queda en una página que ya no existe', () => {
    const lista = signal(Array.from({ length: 12 }, (_, indice) => indice + 1));
    const paginacion = paginar(lista, 5, () => 'a');
    paginacion.ir(3);
    lista.set([1, 2, 3]);
    expect(paginacion.pagina()).toBe(1);
    expect(paginacion.paginas()).toBe(1);
    expect(paginacion.visibles()).toEqual([1, 2, 3]);
  });
});
