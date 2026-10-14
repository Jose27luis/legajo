import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { Inject, Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import type { Response } from 'express';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ENTORNO, type Entorno } from '../environment/environment';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aTextoOpcional, hoyEnLima } from '../common/dates';
import { nombreTrabajador } from '../common/names';
import { enviarLibro, type ColumnaHoja } from '../common/xlsx-stream';
import { carpetaTrabajador, filtroVisibilidad, incluirDocumento, slug, type DocumentoCompleto } from './document.mapper';
import { ejecutar } from './pdf-tools';

const ANCHO = 595;
const ALTO = 842;
const MARGEN = 48;
const AZUL = rgb(0.075, 0.176, 0.275);
const GRIS = rgb(0.38, 0.45, 0.52);

const TEXTO_ESTADO: Readonly<Record<string, string>> = {
  DISPONIBLE: 'Registrado',
  PROCESANDO: 'Procesando',
  ERROR: 'Con error',
  ANULADO: 'Anulado',
};

const formatoGeneracion = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Lima',
});

function compatible(texto: string): string {
  return [...texto.normalize('NFC')].map((caracter) => (caracter.charCodeAt(0) <= 0xff ? caracter : '-')).join('');
}

function fechaLegible(fecha: string | null): string {
  if (fecha === null) {
    return 'sin fecha';
  }
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

interface TrabajadorExpediente {
  id: string;
  numeroDoc: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  estado: string;
  regimen: string | null;
}

@Injectable()
export class DossierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async pdf(
    trabajadorId: string,
    secciones: number[] | null,
    portada: boolean,
    sesion: SesionActiva,
    cliente: DatosCliente,
    respuesta: Response,
  ): Promise<void> {
    const trabajador = await this.trabajador(trabajadorId);
    const documentos = (await this.documentos(trabajadorId, secciones, sesion)).filter(
      (documento) => documento.estado === 'DISPONIBLE' && documento.archivoActualId !== null,
    );
    if (documentos.length === 0) {
      throw new NotFoundException('No hay PDF registrados en las secciones elegidas');
    }
    const carpeta = `${this.entorno.DIR_SUBIDAS}/expedientes/${randomUUID()}`;
    const salida = `${carpeta}/expediente.pdf`;
    try {
      await mkdir(carpeta, { recursive: true });
      const entradas: string[] = [];
      if (portada) {
        const ruta = `${carpeta}/portada.pdf`;
        await writeFile(ruta, await this.portada(trabajador, documentos, sesion));
        entradas.push(ruta);
      }
      for (const documento of documentos) {
        const archivo = documento.archivos.find((item) => item.id === documento.archivoActualId);
        if (archivo !== undefined) {
          entradas.push(`${this.entorno.DIR_ARCHIVOS}/${archivo.ruta}`);
        }
      }
      const resultado = await ejecutar('qpdf', ['--empty', '--pages', ...entradas, '--', salida]);
      if (resultado.codigo !== 0 && resultado.codigo !== 3) {
        throw new InternalServerErrorException('No se pudo unir los PDF del expediente');
      }
      await this.auditoria.registrar({
        accion: 'LEGAJO_DESCARGAR',
        entidad: 'trabajador',
        entidadId: trabajadorId,
        trabajadorId,
        usuarioId: sesion.usuarioId,
        cliente,
        detalle: {
          formato: 'pdf',
          portada,
          secciones: secciones === null ? 'todas' : secciones.join(','),
          documentos: documentos.map((documento) => documento.id),
        },
      });
      const nombre = `${carpetaTrabajador(trabajador)}.pdf`;
      respuesta.setHeader('Content-Type', 'application/pdf');
      respuesta.setHeader('Content-Disposition', `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`);
      respuesta.setHeader('Cache-Control', 'private, no-store');
      await new Promise<void>((resolver, rechazar) => {
        const flujo = createReadStream(salida);
        flujo.on('error', rechazar);
        respuesta.on('close', () => resolver());
        flujo.pipe(respuesta);
      });
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  }

  async indice(trabajadorId: string, secciones: number[] | null, sesion: SesionActiva, respuesta: Response): Promise<void> {
    const trabajador = await this.trabajador(trabajadorId);
    const documentos = (await this.documentos(trabajadorId, secciones, sesion)).filter((documento) => documento.estado !== 'ANULADO');
    const columnas: ColumnaHoja[] = [
      { titulo: 'Sección', ancho: 9, tipo: 'numero' },
      { titulo: 'Código', ancho: 9 },
      { titulo: 'Tipo de documento', ancho: 46 },
      { titulo: 'Número', ancho: 16 },
      { titulo: 'Fecha de emisión', ancho: 15, tipo: 'fecha' },
      { titulo: 'Estado', ancho: 13 },
      { titulo: 'Archivo', ancho: 44 },
      { titulo: 'Páginas', ancho: 9, tipo: 'numero' },
    ];
    await enviarLibro(respuesta, {
      nombreArchivo: `indice_${slug(trabajador.numeroDoc, 12)}_${hoyEnLima()}`,
      hoja: 'Índice del legajo',
      columnas,
      filas: documentos.map((documento) => {
        const archivo = documento.archivos.find((item) => item.id === documento.archivoActualId);
        return [
          documento.tipoDocumento.seccion.numero,
          documento.tipoDocumento.codigo,
          documento.tipoDocumento.nombre,
          documento.numero,
          aTextoOpcional(documento.fechaEmision),
          TEXTO_ESTADO[documento.estado] ?? documento.estado,
          archivo?.nombreOriginal ?? null,
          archivo?.paginas ?? null,
        ];
      }),
    });
  }

  private async trabajador(id: string): Promise<TrabajadorExpediente> {
    const trabajador = await this.prisma.trabajador.findUnique({
      where: { id },
      include: { vinculos: { where: { actual: true }, include: { regimen: true }, take: 1 } },
    });
    if (trabajador === null) {
      throw new NotFoundException('El trabajador no existe');
    }
    return {
      id: trabajador.id,
      numeroDoc: trabajador.numeroDoc,
      nombres: trabajador.nombres,
      apellidoPaterno: trabajador.apellidoPaterno,
      apellidoMaterno: trabajador.apellidoMaterno,
      estado: trabajador.estado,
      regimen: trabajador.vinculos[0]?.regimen.nombre ?? null,
    };
  }

  private documentos(trabajadorId: string, secciones: number[] | null, sesion: SesionActiva): Promise<DocumentoCompleto[]> {
    return this.prisma.documento.findMany({
      where: {
        AND: [
          { trabajadorId },
          filtroVisibilidad(sesion),
          secciones === null ? {} : { tipoDocumento: { seccion: { numero: { in: secciones } } } },
        ],
      },
      include: incluirDocumento,
      orderBy: [{ tipoDocumento: { seccion: { numero: 'asc' } } }, { fechaEmision: 'asc' }, { creadoEn: 'asc' }],
    });
  }

  private async portada(trabajador: TrabajadorExpediente, documentos: DocumentoCompleto[], sesion: SesionActiva): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(compatible(`Expediente digital - ${nombreTrabajador(trabajador)}`));
    pdf.setCreator('Legajos de Personal - DIRESA Madre de Dios');
    const normal = await pdf.embedFont(StandardFonts.Helvetica);
    const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
    const usuario = await this.prisma.usuario.findUnique({ where: { id: sesion.usuarioId }, select: { nombreCompleto: true } });

    let pagina = pdf.addPage([ANCHO, ALTO]);
    const escribir = (destino: PDFPage, texto: string, x: number, y: number, tamano: number, fuente: PDFFont, color = AZUL) => {
      destino.drawText(compatible(texto), { x, y, size: tamano, font: fuente, color });
    };
    escribir(pagina, 'DIRESA MADRE DE DIOS', MARGEN, 785, 19, negrita);
    escribir(pagina, 'OFICINA DE PERSONAL - ÁREA DE LEGAJOS', MARGEN, 760, 11, normal, GRIS);
    pagina.drawLine({ start: { x: MARGEN, y: 742 }, end: { x: ANCHO - MARGEN, y: 742 }, thickness: 1, color: AZUL });
    escribir(pagina, 'EXPEDIENTE DIGITAL DEL TRABAJADOR', MARGEN, 708, 16, negrita);
    escribir(pagina, `Trabajador: ${nombreTrabajador(trabajador)}`, MARGEN, 678, 11, normal);
    escribir(pagina, `DNI: ${trabajador.numeroDoc}   Régimen: ${trabajador.regimen ?? 'sin vínculo'}   Estado: ${trabajador.estado}`, MARGEN, 660, 11, normal);
    escribir(pagina, `Generado el ${formatoGeneracion.format(new Date())} por ${usuario?.nombreCompleto ?? 'el sistema'}`, MARGEN, 642, 9, normal, GRIS);
    escribir(pagina, `ÍNDICE DE DOCUMENTOS INCORPORADOS (${documentos.length})`, MARGEN, 608, 11, negrita);

    let y = 586;
    for (const [indice, documento] of documentos.entries()) {
      if (y < 60) {
        pagina = pdf.addPage([ANCHO, ALTO]);
        escribir(pagina, 'ÍNDICE DE DOCUMENTOS (continuación)', MARGEN, 790, 11, negrita);
        y = 766;
      }
      const archivo = documento.archivos.find((item) => item.id === documento.archivoActualId);
      const paginas = archivo?.paginas ?? 0;
      const seccion = String(documento.tipoDocumento.seccion.numero).padStart(2, '0');
      const tipo = documento.tipoDocumento.nombre.length > 62 ? `${documento.tipoDocumento.nombre.slice(0, 59)}...` : documento.tipoDocumento.nombre;
      escribir(pagina, `${String(indice + 1).padStart(3, ' ')}. Sección ${seccion} - ${tipo}`, MARGEN + 4, y, 9, normal);
      escribir(
        pagina,
        `N.º ${documento.numero ?? 'sin número'} · emisión ${fechaLegible(aTextoOpcional(documento.fechaEmision))} · ${paginas} pág.`,
        MARGEN + 22,
        y - 11,
        8,
        normal,
        GRIS,
      );
      y -= 26;
    }
    for (const [indice, hoja] of pdf.getPages().entries()) {
      escribir(hoja, `Portada e índice - hoja ${indice + 1} de ${pdf.getPageCount()}`, MARGEN, 30, 8, normal, GRIS);
    }
    return pdf.save();
  }
}
