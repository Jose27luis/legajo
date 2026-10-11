export function valorDe(evento: Event): string {
  const objetivo = evento.target;
  if (objetivo instanceof HTMLSelectElement || objetivo instanceof HTMLInputElement || objetivo instanceof HTMLTextAreaElement) {
    return objetivo.value;
  }
  return '';
}

export function numeroDe(evento: Event): number | null {
  const valor = valorDe(evento);
  return valor === '' ? null : Number(valor);
}

export function marcadoDe(evento: Event): boolean {
  return evento.target instanceof HTMLInputElement && evento.target.checked;
}
