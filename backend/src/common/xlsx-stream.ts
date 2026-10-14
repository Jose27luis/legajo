import { Readable } from 'node:stream';
import { ZipArchive } from 'archiver';
import type { Response } from 'express';

export type CeldaValor = string | number | null;

export type TipoColumna = 'texto' | 'numero' | 'fecha' | 'estado';

export interface ColumnaHoja {
  titulo: string;
  ancho: number;
  tipo?: TipoColumna;
}

export interface LibroExcel {
  nombreArchivo: string;
  hoja: string;
  titulo?: string;
  descripcion?: string;
  columnas: ColumnaHoja[];
  filas: AsyncIterable<CeldaValor[]> | Iterable<CeldaValor[]>;
}

const INSTITUCION = 'DIRESA MADRE DE DIOS · Oficina de Personal / Área de Legajos';
const FILA_ENCABEZADO = 5;

const ESTILO = {
  institucion: 1,
  titulo: 2,
  detalle: 3,
  encabezado: 4,
  texto: 5,
  fecha: 7,
  numero: 9,
  verde: 11,
  gris: 12,
  rojo: 13,
  ambar: 14,
  total: 15,
  totalRelleno: 16,
} as const;

const TONOS_ESTADO: readonly [RegExp, number][] = [
  [/^(activo|registrado|completo|disponible|correcto|si)$/, ESTILO.verde],
  [/^(cesado|anulado|no aplica|sin movimiento)$/, ESTILO.gris],
  [/^(vencido|faltante|con error|error|fallido)$/, ESTILO.rojo],
  [/^(por vencer|procesando|pendiente|parcial)/, ESTILO.ambar],
];

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

const relleno = (color: string): string => `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`;
const fuente = (tamano: number, color: string, negrita = false): string =>
  `<font>${negrita ? '<b/>' : ''}<sz val="${tamano}"/><color rgb="FF${color}"/><name val="Calibri"/><family val="2"/></font>`;
const lado = (nombre: string, color: string, estilo = 'thin'): string => `<${nombre} style="${estilo}"><color rgb="FF${color}"/></${nombre}>`;
const centrado = '<alignment horizontal="center" vertical="center"/>';
const medio = '<alignment vertical="center"/>';
const xf = (formato: number, fuenteId: number, rellenoId: number, bordeId: number, alineacion: string): string =>
  `<xf numFmtId="${formato}" fontId="${fuenteId}" fillId="${rellenoId}" borderId="${bordeId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${alineacion}</xf>`;

const ESTILOS = `${CABECERA}
<styleSheet xmlns="${ESPACIO_HOJA}">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="10">
${fuente(11, '243B53')}
${fuente(13, 'FFFFFF', true)}
${fuente(15, '173D5B', true)}
${fuente(10, '5B6B7A')}
${fuente(10.5, 'FFFFFF', true)}
${fuente(10.5, '1E7A46', true)}
${fuente(10.5, '5B6770', true)}
${fuente(10.5, 'B4232F', true)}
${fuente(10.5, '96600C', true)}
${fuente(11, '173D5B', true)}
</fonts>
<fills count="10">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
${relleno('173D5B')}
${relleno('1F5A85')}
${relleno('F3F7FA')}
${relleno('E3F4EA')}
${relleno('ECEFF2')}
${relleno('FBE7E9')}
${relleno('FDF1DC')}
${relleno('EAF1F6')}
</fills>
<borders count="4">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border>${lado('left', '3C77A3')}${lado('right', '3C77A3')}${lado('top', '3C77A3')}${lado('bottom', '173D5B', 'medium')}<diagonal/></border>
<border>${lado('left', 'D5DEE6')}${lado('right', 'D5DEE6')}${lado('top', 'D5DEE6')}${lado('bottom', 'D5DEE6')}<diagonal/></border>
<border><left/><right/>${lado('top', '173D5B', 'medium')}${lado('bottom', '173D5B', 'thin')}<diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="17">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
${xf(0, 1, 2, 0, '<alignment horizontal="left" vertical="center" indent="1"/>')}
${xf(0, 2, 0, 0, '<alignment vertical="center"/>')}
${xf(0, 3, 0, 0, '<alignment vertical="center"/>')}
${xf(0, 4, 3, 1, '<alignment horizontal="center" vertical="center" wrapText="1"/>')}
${xf(0, 0, 0, 2, medio)}
${xf(0, 0, 4, 2, medio)}
${xf(164, 0, 0, 2, centrado)}
${xf(164, 0, 4, 2, centrado)}
${xf(3, 0, 0, 2, '<alignment horizontal="right" vertical="center"/>')}
${xf(3, 0, 4, 2, '<alignment horizontal="right" vertical="center"/>')}
${xf(0, 5, 5, 2, centrado)}
${xf(0, 6, 6, 2, centrado)}
${xf(0, 7, 7, 2, centrado)}
${xf(0, 8, 8, 2, centrado)}
${xf(0, 9, 9, 3, '<alignment vertical="center" indent="1"/>')}
${xf(0, 9, 9, 3, medio)}
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
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

function texto(referencia: string, valor: string, estilo: number): string {
  return `<c r="${referencia}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
}

function tonoEstado(valor: string): number | null {
  const normal = valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  return TONOS_ESTADO.find(([patron]) => patron.test(normal))?.[1] ?? null;
}

function celda(referencia: string, valor: CeldaValor, tipo: TipoColumna, alterna: boolean): string {
  const desplazamiento = alterna ? 1 : 0;
  const vacia = `<c r="${referencia}" s="${(tipo === 'fecha' ? ESTILO.fecha : tipo === 'numero' ? ESTILO.numero : ESTILO.texto) + desplazamiento}"/>`;
  if (valor === null || valor === '') {
    return vacia;
  }
  if (tipo === 'numero' && typeof valor === 'number') {
    return `<c r="${referencia}" s="${ESTILO.numero + desplazamiento}"><v>${valor}</v></c>`;
  }
  if (tipo === 'fecha' && typeof valor === 'string') {
    const serial = serialExcel(valor);
    if (serial !== null) {
      return `<c r="${referencia}" s="${ESTILO.fecha + desplazamiento}"><v>${serial}</v></c>`;
    }
  }
  if (tipo === 'estado') {
    const tono = tonoEstado(String(valor));
    if (tono !== null) {
      return texto(referencia, String(valor), tono);
    }
  }
  return texto(referencia, String(valor), ESTILO.texto + desplazamiento);
}

function limpiarNombreHoja(nombre: string): string {
  const limpio = nombre.replace(/[:\\/?*[\]']/g, ' ').trim();
  return limpio.length === 0 ? 'Hoja1' : limpio.slice(0, 31);
}

function libroXml(hoja: string, ultima: string): string {
  const nombre = escaparXml(limpiarNombreHoja(hoja));
  return `${CABECERA}
<workbook xmlns="${ESPACIO_HOJA}" xmlns:r="${ESPACIO_DOCUMENTO}">
<sheets><sheet name="${nombre}" sheetId="1" r:id="rId1"/></sheets>
<definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${nombre}'!$${FILA_ENCABEZADO}:$${FILA_ENCABEZADO}</definedName><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${nombre}'!$A$${FILA_ENCABEZADO}:$${ultima}$${FILA_ENCABEZADO}</definedName></definedNames>
</workbook>`;
}

function generadoEn(): string {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date());
}

function filaCompleta(numero: number, ultimaIndice: number, valor: string, estilo: number, relleno: number, alto: number): string {
  const resto = Array.from({ length: ultimaIndice }, (_, indice) => `<c r="${columnaLetra(indice + 1)}${numero}" s="${relleno}"/>`).join('');
  return `<row r="${numero}" ht="${alto}" customHeight="1">${texto(`A${numero}`, valor, estilo)}${resto}</row>`;
}

async function* hojaXml(libro: LibroExcel): AsyncGenerator<string> {
  const ultimaIndice = Math.max(0, libro.columnas.length - 1);
  const ultima = columnaLetra(ultimaIndice);
  const columnas = libro.columnas
    .map((columna, indice) => `<col min="${indice + 1}" max="${indice + 1}" width="${columna.ancho + 2}" customWidth="1"/>`)
    .join('');
  const encabezado = libro.columnas
    .map((columna, indice) => texto(`${columnaLetra(indice)}${FILA_ENCABEZADO}`, columna.titulo, ESTILO.encabezado))
    .join('');
  const detalle = [libro.descripcion, `Generado el ${generadoEn()}`].filter((parte) => parte !== undefined && parte !== '').join(' · ');
  yield `${CABECERA}
<worksheet xmlns="${ESPACIO_HOJA}" xmlns:r="${ESPACIO_DOCUMENTO}">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="100"><pane ySplit="${FILA_ENCABEZADO}" topLeftCell="A${FILA_ENCABEZADO + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${FILA_ENCABEZADO + 1}" sqref="A${FILA_ENCABEZADO + 1}"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18" customHeight="1"/>
<cols>${columnas}</cols>
<sheetData>
${filaCompleta(1, ultimaIndice, INSTITUCION, ESTILO.institucion, ESTILO.institucion, 26)}
<row r="2" ht="24" customHeight="1">${texto('A2', libro.titulo ?? libro.hoja, ESTILO.titulo)}</row>
<row r="3" ht="16" customHeight="1">${texto('A3', detalle, ESTILO.detalle)}</row>
<row r="4" ht="8" customHeight="1"/>
<row r="${FILA_ENCABEZADO}" ht="32" customHeight="1">${encabezado}</row>`;
  let numero = FILA_ENCABEZADO;
  for await (const fila of libro.filas) {
    numero += 1;
    const alterna = (numero - FILA_ENCABEZADO) % 2 === 0;
    const celdas = libro.columnas
      .map((columna, indice) => celda(`${columnaLetra(indice)}${numero}`, fila[indice] ?? null, columna.tipo ?? 'texto', alterna))
      .join('');
    yield `<row r="${numero}" ht="20" customHeight="1">${celdas}</row>`;
  }
  const registros = numero - FILA_ENCABEZADO;
  const total = filaCompleta(
    numero + 1,
    ultimaIndice,
    `Total: ${registros} ${registros === 1 ? 'registro' : 'registros'}`,
    ESTILO.total,
    ESTILO.totalRelleno,
    22,
  );
  const combinadas = ultimaIndice > 0 ? `<mergeCells count="1"><mergeCell ref="A1:${ultima}1"/></mergeCells>` : '';
  yield `${total}</sheetData>
<autoFilter ref="A${FILA_ENCABEZADO}:${ultima}${Math.max(numero, FILA_ENCABEZADO)}"/>
${combinadas}
<printOptions horizontalCentered="1"/>
<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>&amp;L&amp;8DIRESA Madre de Dios · Área de Legajos&amp;R&amp;8Página &amp;P de &amp;N</oddFooter></headerFooter>
</worksheet>`;
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
  archivador.append(libroXml(libro.hoja, columnaLetra(Math.max(0, libro.columnas.length - 1))), { name: 'xl/workbook.xml' });
  archivador.append(RELACIONES_LIBRO, { name: 'xl/_rels/workbook.xml.rels' });
  archivador.append(ESTILOS, { name: 'xl/styles.xml' });
  archivador.append(Readable.from(hojaXml(libro)), { name: 'xl/worksheets/sheet1.xml' });
  await archivador.finalize();
}
