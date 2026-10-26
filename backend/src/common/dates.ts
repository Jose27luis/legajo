const formatoLima = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function hoyEnLima(): string {
  return formatoLima.format(new Date());
}

export function fechaEnLima(fecha: Date): string {
  return formatoLima.format(fecha);
}

export function aFecha(texto: string): Date {
  return new Date(`${texto}T00:00:00.000Z`);
}

export function aTexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function aTextoOpcional(fecha: Date | null): string | null {
  return fecha === null ? null : aTexto(fecha);
}

export function aTextoDeFila(valor: Date | string | null): string | null {
  if (valor === null) {
    return null;
  }
  return typeof valor === 'string' ? valor.slice(0, 10) : aTexto(valor);
}

export function diaAnterior(texto: string): string {
  const fecha = aFecha(texto);
  fecha.setUTCDate(fecha.getUTCDate() - 1);
  return aTexto(fecha);
}

export function diaSiguiente(texto: string): string {
  const fecha = aFecha(texto);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return aTexto(fecha);
}

export function normalizarBusqueda(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
