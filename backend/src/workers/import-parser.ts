import { Readable } from 'node:stream';
import { BadRequestException } from '@nestjs/common';
import { Workbook, type CellValue } from 'exceljs';
import { normalizarBusqueda } from '../common/dates';

export type FilaLeida = Record<string, string>;

export const MAXIMO_FILAS = 3000;
const MARCA_BOM = 0xfeff;

function clave(encabezado: string): string {
  return normalizarBusqueda(encabezado)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function separarCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? '';
  const separador = primeraLinea.split(';').length >= primeraLinea.split(',').length ? ';' : ',';
  for (let indice = 0; indice < texto.length; indice++) {
    const caracter = texto[indice];
    if (entreComillas) {
      if (caracter === '"' && texto[indice + 1] === '"') {
        celda += '"';
        indice++;
      } else if (caracter === '"') {
        entreComillas = false;
      } else {
        celda += caracter;
      }
      continue;
    }
    if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === separador) {
      fila.push(celda);
      celda = '';
    } else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && texto[indice + 1] === '\n') {
        indice++;
      }
      fila.push(celda);
      if (fila.some((valor) => valor.trim() !== '')) {
        filas.push(fila);
      }
      fila = [];
      celda = '';
    } else {
      celda += caracter;
    }
  }
  fila.push(celda);
  if (fila.some((valor) => valor.trim() !== '')) {
    filas.push(fila);
  }
  return filas;
}

function aObjetos(filas: string[][]): FilaLeida[] {
  const [encabezados, ...datos] = filas;
  if (encabezados === undefined) {
    throw new BadRequestException('El archivo está vacío');
  }
  const claves = encabezados.map(clave);
  if (datos.length > MAXIMO_FILAS) {
    throw new BadRequestException(`El archivo tiene ${datos.length} filas. El máximo es ${MAXIMO_FILAS} por importación.`);
  }
  return datos.map((fila) => Object.fromEntries(claves.map((nombre, posicion) => [nombre, (fila[posicion] ?? '').trim()])));
}

function textoDeCelda(valor: CellValue): string {
  if (valor === null || valor === undefined) {
    return '';
  }
  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }
  if (typeof valor === 'object') {
    if ('text' in valor && typeof valor.text === 'string') {
      return valor.text;
    }
    if ('result' in valor) {
      const resultado = valor.result;
      if (resultado instanceof Date) {
        return resultado.toISOString().slice(0, 10);
      }
      return typeof resultado === 'string' || typeof resultado === 'number' || typeof resultado === 'boolean' ? String(resultado) : '';
    }
    if ('richText' in valor) {
      return valor.richText.map((parte) => parte.text).join('');
    }
    return '';
  }
  return String(valor);
}

export async function leerArchivo(nombre: string, contenido: Buffer): Promise<FilaLeida[]> {
  const extension = nombre.toLowerCase().split('.').pop() ?? '';
  if (extension === 'csv') {
    const texto = contenido.toString('utf8');
    return aObjetos(separarCsv(texto.charCodeAt(0) === MARCA_BOM ? texto.slice(1) : texto));
  }
  if (extension === 'xls') {
    throw new BadRequestException('El formato .xls antiguo no se admite. Guarda el archivo como .xlsx o .csv.');
  }
  if (extension !== 'xlsx') {
    throw new BadRequestException('Formato no permitido. Usa un archivo .csv o .xlsx.');
  }
  const libro = new Workbook();
  try {
    await libro.xlsx.read(Readable.from(contenido));
  } catch {
    throw new BadRequestException('No se pudo leer el archivo de Excel');
  }
  const hoja = libro.worksheets[0];
  if (hoja === undefined) {
    throw new BadRequestException('El archivo de Excel no tiene hojas');
  }
  const filas: string[][] = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const valores: string[] = [];
    for (let columna = 1; columna <= hoja.columnCount; columna++) {
      valores.push(textoDeCelda(fila.getCell(columna).value).trim());
    }
    if (valores.some((valor) => valor !== '')) {
      filas.push(valores);
    }
  });
  return aObjetos(filas);
}
