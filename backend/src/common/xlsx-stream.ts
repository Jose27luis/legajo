import { Readable } from 'node:stream';
import { ZipArchive } from 'archiver';
import type { Response } from 'express';

export type CeldaValor = string | number | null;

export type TipoColumna = 'texto' | 'numero' | 'fecha';

export interface ColumnaHoja {
  titulo: string;
  ancho: number;
  tipo?: TipoColumna;
}

export interface LibroExcel {
  nombreArchivo: string;
  hoja: string;
  columnas: ColumnaHoja[];
  filas: AsyncIterable<CeldaValor[]> | Iterable<CeldaValor[]>;
}

const CABECERA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const ESPACIO_HOJA = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const ESPACIO_PAQUETE = 'http://schemas.openxmlformats.org/package/2006/relationships';
const ESPACIO_DOCUMENTO = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const DIA_MS = 86400000;
const BASE_EXCEL = Date.UTC(1899, 11, 30);

const TIPOS = `${CABECERA}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const RELACIONES = `${CABECERA}
<Relationships xmlns="${ESPACIO_PAQUETE}">
<Relationship Id="rId1" Type="${ESPACIO_DOCUMENTO}/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const RELACIONES_LIBRO = `${CABECERA}
<Relationships xmlns="${ESPACIO_PAQUETE}">
<Relationship Id="rId1" Type="${ESPACIO_DOCUMENTO}/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="${ESPACIO_DOCUMENTO}/styles" Target="styles.xml"/>
</Relationships>`;

const ESTILOS = `${CABECERA}
<styleSheet xmlns="${ESPACIO_HOJA}">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;

function sinControles(texto: string): string {
  let salida = '';
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0) ?? 0;
    if (codigo >= 32 || codigo === 9 || codigo === 10 || codigo === 13) {
      salida += caracter;
    }
  }
  return salida;
}

export function escaparXml(texto: string): string {
  return sinControles(texto).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function columnaLetra(indice: number): string {
  let resto = indice;
  let letra = '';
  do {
    letra = String.fromCharCode(65 + (resto % 26)) + letra;
    resto = Math.floor(resto / 26) - 1;
  } while (resto >= 0);
  return letra;
}

function serialExcel(texto: string): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (partes === null) {
    return null;
  }
  const fecha = Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  return Math.round((fecha - BASE_EXCEL) / DIA_MS);
}

function celda(referencia: string, valor: CeldaValor, tipo: TipoColumna): string {
  if (valor === null || valor === '') {
    return '';
  }
  if (tipo === 'numero' && typeof valor === 'number') {
    return `<c r="${referencia}"><v>${valor}</v></c>`;
  }
  if (tipo === 'fecha' && typeof valor === 'string') {
    const serial = serialExcel(valor);
    if (serial !== null) {
      return `<c r="${referencia}" s="2"><v>${serial}</v></c>`;
    }
  }
  return `<c r="${referencia}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(String(valor))}</t></is></c>`;
}

function nombreHoja(nombre: string): string {
  const limpio = nombre.replace(/[:\\/?*[\]]/g, ' ').trim();
  return escaparXml(limpio.length === 0 ? 'Hoja1' : limpio.slice(0, 31));
}

function libroXml(hoja: string): string {
  return `${CABECERA}
<workbook xmlns="${ESPACIO_HOJA}" xmlns:r="${ESPACIO_DOCUMENTO}">
<sheets><sheet name="${nombreHoja(hoja)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

async function* hojaXml(libro: LibroExcel): AsyncGenerator<string> {
  const columnas = libro.columnas
    .map((columna, indice) => `<col min="${indice + 1}" max="${indice + 1}" width="${columna.ancho}" customWidth="1"/>`)
    .join('');
  const encabezado = libro.columnas
    .map((columna, indice) => `<c r="${columnaLetra(indice)}1" s="1" t="inlineStr"><is><t>${escaparXml(columna.titulo)}</t></is></c>`)
    .join('');
  yield `${CABECERA}
<worksheet xmlns="${ESPACIO_HOJA}">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${columnas}</cols>
<sheetData>
<row r="1">${encabezado}</row>`;
  let numero = 1;
  for await (const fila of libro.filas) {
    numero += 1;
    const celdas = fila
      .map((valor, indice) => celda(`${columnaLetra(indice)}${numero}`, valor, libro.columnas[indice]?.tipo ?? 'texto'))
      .join('');
    yield `<row r="${numero}">${celdas}</row>`;
  }
  yield '</sheetData></worksheet>';
}

export async function enviarLibro(respuesta: Response, libro: LibroExcel): Promise<void> {
  respuesta.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  respuesta.setHeader('Content-Disposition', `attachment; filename="${libro.nombreArchivo}.xlsx"`);
  respuesta.setHeader('Cache-Control', 'private, no-store');
  respuesta.setHeader('X-Accel-Buffering', 'no');

  const archivador = new ZipArchive({ zlib: { level: 6 } });
  respuesta.on('close', () => {
    if (!respuesta.writableFinished) {
      void archivador.abort();
    }
  });
  archivador.on('error', () => respuesta.destroy());
  archivador.pipe(respuesta);
  archivador.append(TIPOS, { name: '[Content_Types].xml' });
  archivador.append(RELACIONES, { name: '_rels/.rels' });
  archivador.append(libroXml(libro.hoja), { name: 'xl/workbook.xml' });
  archivador.append(RELACIONES_LIBRO, { name: 'xl/_rels/workbook.xml.rels' });
  archivador.append(ESTILOS, { name: 'xl/styles.xml' });
  archivador.append(Readable.from(hojaXml(libro)), { name: 'xl/worksheets/sheet1.xml' });
  await archivador.finalize();
}
