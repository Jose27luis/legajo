export interface NombreInterpretado {
  numeroDoc: string;
  codigo: string;
  numero: string | null;
  fechaEmision: string | null;
}

const DOCUMENTO = /^[A-Za-z0-9]{8,12}$/;
const CODIGO = /^\d{4}$/;
const OCHO_DIGITOS = /^(\d{4})(\d{2})(\d{2})$/;
const MAXIMO_NUMERO = 60;

function aFechaValida(texto: string): string | null {
  const partes = OCHO_DIGITOS.exec(texto);
  if (partes === null) {
    return null;
  }
  const [, anio, mes, dia] = partes;
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  const iso = `${anio}-${mes}-${dia}`;
  return Number(anio) >= 1900 && fecha.toISOString().slice(0, 10) === iso ? iso : null;
}

export function interpretarNombre(nombreArchivo: string): NombreInterpretado | null {
  const base = /^(.+)\.pdf$/i.exec(nombreArchivo.trim())?.[1];
  if (base === undefined) {
    return null;
  }
  const partes = base.split('_').map((parte) => parte.trim());
  if (partes.length < 2 || partes.some((parte) => parte === '')) {
    return null;
  }
  const [documento, codigo, ...resto] = partes;
  if (!DOCUMENTO.test(documento) || !CODIGO.test(codigo)) {
    return null;
  }
  const ultima = resto.at(-1);
  const fechaEmision = ultima === undefined ? null : aFechaValida(ultima);
  if (fechaEmision !== null) {
    resto.pop();
  }
  const numero = resto.length === 0 ? null : resto.join('_');
  if (numero !== null && numero.length > MAXIMO_NUMERO) {
    return null;
  }
  return { numeroDoc: documento.toUpperCase(), codigo, numero, fechaEmision };
}
