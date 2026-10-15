const formatoFechaHora = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Lima',
});

export function fechaHora(valor: string | null): string {
  return valor === null ? 'Nunca' : formatoFechaHora.format(new Date(valor));
}

export function normalizarTexto(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
