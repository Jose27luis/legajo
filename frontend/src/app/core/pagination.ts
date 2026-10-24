import { computed, linkedSignal, type Signal } from '@angular/core';

export interface Paginacion<T> {
  pagina: Signal<number>;
  paginas: Signal<number>;
  total: Signal<number>;
  visibles: Signal<readonly T[]>;
  ir(pagina: number): void;
}

export function paginar<T>(lista: () => readonly T[], porPagina: number, reinicio: () => unknown): Paginacion<T> {
  const elegida = linkedSignal({ source: reinicio, computation: () => 1 });
  const total = computed(() => lista().length);
  const paginas = computed(() => Math.max(1, Math.ceil(total() / porPagina)));
  const pagina = computed(() => Math.min(Math.max(elegida(), 1), paginas()));
  const visibles = computed(() => lista().slice((pagina() - 1) * porPagina, pagina() * porPagina));
  return { pagina, paginas, total, visibles, ir: (destino) => elegida.set(destino) };
}
