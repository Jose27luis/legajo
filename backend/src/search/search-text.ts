import { normalizarBusqueda } from '../common/dates';

export const CLASES = ['IDENTIDAD', 'NUMERO', 'NOMBRE'] as const;

export type ClaseBusqueda = (typeof CLASES)[number];

export interface TextoBusqueda {
  clase: ClaseBusqueda;
  texto: string;
  normalizado: string;
  palabras: string[];
}

const MINIMO = 2;

export function interpretarTexto(entrada: string | null | undefined): TextoBusqueda | null {
  const texto = (entrada ?? '').trim().replace(/\s+/g, ' ');
  if (texto.length < MINIMO) {
    return null;
  }
  const normalizado = normalizarBusqueda(texto);
  const palabras = normalizado.split(' ').filter((palabra) => palabra.length > 0);
  const clase = clasificar(texto);
  return { clase, texto, normalizado, palabras };
}

function clasificar(texto: string): ClaseBusqueda {
  if (/^\d{8,12}$/.test(texto)) {
    return 'IDENTIDAD';
  }
  if (/^\d[\d\-/.]*\d$/.test(texto) && /[-/.]/.test(texto)) {
    return 'NUMERO';
  }
  return 'NOMBRE';
}
