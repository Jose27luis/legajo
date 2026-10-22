import { createReadStream } from 'node:fs';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ZipArchive } from 'archiver';
import type { Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ENTORNO, type Entorno } from '../environment/environment';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aFecha, aTextoOpcional, hoyEnLima } from '../common/dates';
import { aTipoDto } from '../catalogs/document-types.service';
import { leerCampos, referenciasACatalogo, validarDatos, type CatalogoReferido } from '../catalogs/section-fields';
import type {
  CreateDocumentDto,
  DeleteDocumentDto,
  DocumentFieldsDto,
  ReplaceDocumentDto,
  UpdateDocumentDto,
  VoidDocumentDto,
} from './dto/document-input.dto';
import type { DocumentDto, DocumentHistoryEntryDto, LegajoDto, LegajoSectionDto } from './dto/document.dto';
import {
  aDocumentoDto,
  carpetaTrabajador,
  filtroVisibilidad,
  incluirDocumento,
  nombreDescarga,
  puedeEditar,
  seccionPermitida,
  type DocumentoCompleto,
} from './document.mapper';
import { DocumentQueueService } from './document-queue.service';
import { UploadServerService } from './upload-server.service';
import { LaborService } from '../labor/labor.service';
import { AuthService } from '../auth/auth.service';
import { CODIGO_FICHA_TEXTO } from '../seed-catalogs';

const EVENTOS_DOCUMENTO: Readonly<Record<string, string>> = {
  DOCUMENTO_SUBIR: 'Registrado',
  DOCUMENTO_EDITAR: 'Datos modificados',
  DOCUMENTO_RECLASIFICAR: 'Reclasificado',
  DOCUMENTO_REEMPLAZAR: 'PDF reemplazado por una versión corregida',
  DOCUMENTO_ANULAR: 'Anulado',
  DOCUMENTO_REINTENTAR: 'Procesamiento reintentado',
  DOCUMENTO_VINCULAR: 'Vinculado al historial de la Sección 01',
  DOCUMENTO_CONFIRMAR: 'Confirmado en la Sección 01',
};

const CAMPOS_HISTORIAL: Readonly<Record<string, string>> = {
  tipo: 'Tipo de documento',
  numero: 'Número de documento',
  fechaEmision: 'Fecha de emisión',
  fechaVencimiento: 'Fecha de vencimiento',
  emisor: 'Emisor',
  observaciones: 'Descripción',
  ubicacionFisica: 'Ubicación física',
  nivelAcceso: 'Nivel de acceso',
  datos: 'Datos propios',
};

const valoresHistorial = z.record(z.string(), z.union([z.string(), z.null()]));
const esquemaDetalle = z.object({
  motivo: z.string().optional(),
  antes: valoresHistorial.optional(),
  despues: valoresHistorial.optional(),
});

export interface ArchivoParaEntregar {
  ruta: string;
  nombre: string;
}

interface EntradaZip {
  ruta: string;
  nombre: string;
}

export interface NuevoDocumento {
  trabajadorId: string;
  validados: DatosValidados;
  subidaId: string;
  nombreOriginal: string;
  sesion: SesionActiva;
  cliente: DatosCliente;
  loteItemId: string | null;
  vinculoId: string | null;
}

export interface DatosValidados {
  tipoDocumentoId: number;
  numero: string | null;
  fechaEmision: Date | null;
  fechaVencimiento: Date | null;
  emisor: string | null;
  observaciones: string | null;
  ubicacionFisica: string | null;
  nivelAcceso: 'NORMAL' | 'RESTRINGIDO' | 'MUY_RESTRINGIDO';
  datos: Prisma.InputJsonObject;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
    private readonly cola: DocumentQueueService,
    private readonly subidas: UploadServerService,
    private readonly laboral: LaborService,
    private readonly autenticacion: AuthService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async secciones(sesion: SesionActiva): Promise<LegajoSectionDto[]> {
    const verRestringidos = sesion.permisos.includes('documentos.restringidos');
    const secciones = await this.prisma.seccion.findMany({
      orderBy: { numero: 'asc' },
      include: {
        tipos: {
          where: { activo: true, codigo: { not: CODIGO_FICHA_TEXTO }, ...(verRestringidos ? {} : { restringido: false }) },
          orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
        },
      },
    });
    return secciones.map((seccion) => {
      const restringida = !seccionPermitida(sesion, seccion.numero);
      return {
        id: seccion.id,
        numero: seccion.numero,
        nombre: seccion.nombre,
        descripcion: seccion.descripcion,
        campos: leerCampos(seccion.campos),
        tipos: restringida ? [] : seccion.tipos.map(aTipoDto),
        total: 0,
        restringida,
      };
    });
  }

  async legajo(trabajadorId: string, sesion: SesionActiva): Promise<LegajoDto> {
    await this.exigirTrabajador(trabajadorId);
    const [secciones, documentos] = await Promise.all([
      this.secciones(sesion),
      this.prisma.documento.findMany({
        where: { trabajadorId, ...filtroVisibilidad(sesion) },
        include: incluirDocumento,
        orderBy: [{ tipoDocumento: { orden: 'asc' } }, { fechaEmision: 'desc' }, { creadoEn: 'desc' }],
      }),
    ]);
    return {
      secciones: secciones.map((seccion) => ({
        ...seccion,
        total: documentos.filter(
          (documento) => documento.tipoDocumento.seccionId === seccion.id && documento.estado !== 'ANULADO',
        ).length,
      })),
      documentos: documentos.map((documento) => aDocumentoDto(documento, sesion)),
    };
  }

  async registrar(trabajadorId: string, datos: CreateDocumentDto, sesion: SesionActiva, cliente: DatosCliente): Promise<DocumentDto> {
    await this.exigirTrabajador(trabajadorId);
    const validados = await this.validar(datos, sesion, null);
    const nombreOriginal = await this.exigirSubida(datos.subidaId, sesion);
    const creado = await this.prisma.$transaction((transaccion) =>
      this.crearDocumento(transaccion, {
        trabajadorId,
        validados,
        subidaId: datos.subidaId,
        nombreOriginal,
        sesion,
        cliente,
        loteItemId: null,
        vinculoId: datos.vinculoId,
      }),
    );
    await this.encolar(creado.id, datos.subidaId, nombreOriginal, sesion.usuarioId);
    return aDocumentoDto(creado, sesion);
  }

  async crearDocumento(transaccion: Prisma.TransactionClient, nuevo: NuevoDocumento): Promise<DocumentoCompleto> {
    const documento = await transaccion.documento.create({
      data: {
        ...nuevo.validados,
        trabajadorId: nuevo.trabajadorId,
        creadoPorId: nuevo.sesion.usuarioId,
        subidaPendiente: nuevo.subidaId,
        loteItemId: nuevo.loteItemId,
      },
      include: incluirDocumento,
    });
    await this.auditoria.registrar(
      {
        accion: 'DOCUMENTO_SUBIR',
        entidad: 'documento',
        entidadId: documento.id,
        trabajadorId: nuevo.trabajadorId,
        usuarioId: nuevo.sesion.usuarioId,
        cliente: nuevo.cliente,
        detalle: {
          tipo: documento.tipoDocumento.codigo,
          numero: documento.numero,
          archivo: nuevo.nombreOriginal,
          lote: nuevo.loteItemId,
        },
      },
      transaccion,
    );
    await this.laboral.alRegistrar(transaccion, documento, nuevo.vinculoId, nuevo.sesion, nuevo.cliente);
    return transaccion.documento.findUniqueOrThrow({ where: { id: documento.id }, include: incluirDocumento });
  }

  async encolar(documentoId: string, subidaId: string, nombreOriginal: string, usuarioId: string): Promise<void> {
    await this.cola.encolar({ documentoId, subidaId, nombreOriginal, usuarioId });
  }

  async editar(id: string, datos: UpdateDocumentDto, sesion: SesionActiva, cliente: DatosCliente): Promise<DocumentDto> {
    const actual = await this.cargarVisible(id, sesion);
    this.exigirEditable(actual, sesion);
    const validados = await this.validar(datos, sesion, actual.tipoDocumento.seccionId);
    const actualizado = await this.prisma.$transaction(async (transaccion) => {
      const documento = await transaccion.documento.update({
        where: { id },
        data: {
          ...validados,
          modificadoPorId: sesion.usuarioId,
          modificadoEn: new Date(),
          motivoModificacion: datos.motivo,
        },
        include: incluirDocumento,
      });
      await this.auditoria.registrar(
        {
          accion: actual.tipoDocumentoId === validados.tipoDocumentoId ? 'DOCUMENTO_EDITAR' : 'DOCUMENTO_RECLASIFICAR',
          entidad: 'documento',
          entidadId: id,
          trabajadorId: actual.trabajadorId,
          usuarioId: sesion.usuarioId,
          cliente,
          detalle: { motivo: datos.motivo, antes: this.resumen(actual), despues: this.resumen(documento) },
        },
        transaccion,
      );
      return documento;
    });
    return aDocumentoDto(actualizado, sesion);
  }

  async anular(id: string, datos: VoidDocumentDto, sesion: SesionActiva, cliente: DatosCliente): Promise<DocumentDto> {
    const actual = await this.cargarVisible(id, sesion);
    if (actual.estado === 'ANULADO') {
      throw new BadRequestException('El documento ya está anulado');
    }
    const anulado = await this.prisma.$transaction(async (transaccion) => {
      const documento = await transaccion.documento.update({
        where: { id },
        data: {
          estado: 'ANULADO',
          motivoAnulacion: datos.motivo,
          subidaPendiente: null,
          modificadoPorId: sesion.usuarioId,
          modificadoEn: new Date(),
          motivoModificacion: datos.motivo,
        },
        include: incluirDocumento,
      });
      await this.auditoria.registrar(
        {
          accion: 'DOCUMENTO_ANULAR',
          entidad: 'documento',
          entidadId: id,
          trabajadorId: actual.trabajadorId,
          usuarioId: sesion.usuarioId,
          cliente,
          detalle: { motivo: datos.motivo, tipo: actual.tipoDocumento.codigo },
        },
        transaccion,
      );
      return documento;
    });
    if (actual.subidaPendiente !== null) {
      await this.subidas.almacen.remove(actual.subidaPendiente).catch(() => undefined);
    }
    return aDocumentoDto(anulado, sesion);
  }

  async eliminar(id: string, datos: DeleteDocumentDto, sesion: SesionActiva, cliente: DatosCliente): Promise<void> {
    const actual = await this.cargarVisible(id, sesion);
    await this.autenticacion.confirmarClave(sesion, datos.clave, cliente);
    const versionActual =actual.archivos.find((archivo) => archivo.id === actual.archivoActualId) ?? null;
    await this.prisma.$transaction(async (transaccion) => {
      await transaccion.$executeRaw`SELECT set_config('legajos.eliminar_documento', 'on', true)`;
      await transaccion.documento.update({
        where: { id },
        data: { archivoActualId: null, estado: 'ANULADO', motivoAnulacion: datos.motivo, detalleError: null },
      });
      const movimientos = await transaccion.movimientoLaboral.updateMany({ where: { documentoId: id }, data: { documentoId: null } });
      const archivos = await transaccion.documentoArchivo.deleteMany({ where: { documentoId: id } });
      await transaccion.documento.delete({ where: { id } });
      await this.auditoria.registrar(
        {
          accion: 'DOCUMENTO_ELIMINAR',
          entidad: 'documento',
          entidadId: id,
          trabajadorId: actual.trabajadorId,
          usuarioId: sesion.usuarioId,
          cliente,
          detalle: {
            motivo: datos.motivo,
            tipo: actual.tipoDocumento.codigo,
            nombreTipo: actual.tipoDocumento.nombre,
            numero: actual.numero,
            nombreOriginal: versionActual?.nombreOriginal ?? null,
            archivos: archivos.count,
            vinculo: actual.vinculoId,
            movimientoDesvinculado: movimientos.count > 0,
          },
        },
        transaccion,
      );
    });
    if (actual.subidaPendiente !== null) {
      await this.subidas.almacen.remove(actual.subidaPendiente).catch(() => undefined);
    }
    await this.cola.eliminarArchivos({ trabajadorId: actual.trabajadorId, documentoId: id });
  }

  async reemplazar(id: string, datos: ReplaceDocumentDto, sesion: SesionActiva, cliente: DatosCliente): Promise<DocumentDto> {
    const actual = await this.cargarVisible(id, sesion);
    this.exigirEditable(actual, sesion);
    const nombreOriginal = await this.exigirSubida(datos.subidaId, sesion);
    const actualizado = await this.prisma.$transaction(async (transaccion) => {
      const documento = await transaccion.documento.update({
        where: { id },
        data: {
          estado: 'PROCESANDO',
          detalleError: null,
          subidaPendiente: datos.subidaId,
          modificadoPorId: sesion.usuarioId,
          modificadoEn: new Date(),
          motivoModificacion: datos.motivo,
        },
        include: incluirDocumento,
      });
      await this.auditoria.registrar(
        {
          accion: 'DOCUMENTO_REEMPLAZAR',
          entidad: 'documento',
          entidadId: id,
          trabajadorId: actual.trabajadorId,
          usuarioId: sesion.usuarioId,
          cliente,
          detalle: { motivo: datos.motivo, archivo: nombreOriginal },
        },
        transaccion,
      );
      return documento;
    });
    if (actual.subidaPendiente !== null && actual.subidaPendiente !== datos.subidaId) {
      await this.subidas.almacen.remove(actual.subidaPendiente).catch(() => undefined);
    }
    await this.cola.encolar({ documentoId: id, subidaId: datos.subidaId, nombreOriginal, usuarioId: sesion.usuarioId });
    return aDocumentoDto(actualizado, sesion);
  }

  async reintentar(id: string, sesion: SesionActiva, cliente: DatosCliente): Promise<DocumentDto> {
    const actual = await this.cargarVisible(id, sesion);
    const subidaId = actual.subidaPendiente;
    if (subidaId === null || actual.detalleError === null || actual.estado === 'ANULADO') {
      throw new BadRequestException('Este documento no tiene un procesamiento pendiente de reintentar');
    }
    const subida = await this.subidas.obtener(subidaId);
    if (subida === null) {
      throw new BadRequestException('El archivo subido ya no está disponible. Sube el PDF de nuevo.');
    }
    const actualizado = await this.prisma.$transaction(async (transaccion) => {
      const documento = await transaccion.documento.update({
        where: { id },
        data: { estado: 'PROCESANDO', detalleError: null },
        include: incluirDocumento,
      });
      await this.auditoria.registrar(
        {
          accion: 'DOCUMENTO_REINTENTAR',
          entidad: 'documento',
          entidadId: id,
          trabajadorId: actual.trabajadorId,
          usuarioId: sesion.usuarioId,
          cliente,
        },
        transaccion,
      );
      return documento;
    });
    await this.cola.encolar({
      documentoId: id,
      subidaId,
      nombreOriginal: subida.metadata?.['filename'] ?? 'documento.pdf',
      usuarioId: sesion.usuarioId,
    });
    return aDocumentoDto(actualizado, sesion);
  }

  async archivo(id: string, descarga: boolean, sesion: SesionActiva, cliente: DatosCliente): Promise<ArchivoParaEntregar> {
    if (descarga && !sesion.permisos.includes('documentos.descargar')) {
      throw new ForbiddenException('No tienes permiso para descargar documentos');
    }
    const documento = await this.cargarVisible(id, sesion);
    const archivo = documento.archivos.find((item) => item.id === documento.archivoActualId);
    if (archivo === undefined) {
      throw new NotFoundException('El documento todavía no tiene un archivo disponible');
    }
    await this.auditoria.registrar({
      accion: descarga ? 'DOCUMENTO_DESCARGAR' : 'DOCUMENTO_VER',
      entidad: 'documento',
      entidadId: id,
      trabajadorId: documento.trabajadorId,
      usuarioId: sesion.usuarioId,
      cliente,
      detalle: { version: archivo.version },
    });
    return { ruta: archivo.ruta, nombre: nombreDescarga(documento) };
  }

  async zip(
    trabajadorId: string,
    secciones: number[] | null,
    sesion: SesionActiva,
    cliente: DatosCliente,
    respuesta: Response,
  ): Promise<void> {
    const trabajador = await this.prisma.trabajador.findUnique({ where: { id: trabajadorId } });
    if (trabajador === null) {
      throw new NotFoundException('El trabajador no existe');
    }
    const documentos = await this.prisma.documento.findMany({
      where: {
        trabajadorId,
        estado: 'DISPONIBLE',
        ...filtroVisibilidad(sesion),
        ...(secciones === null ? {} : { tipoDocumento: { seccion: { numero: { in: secciones } } } }),
      },
      include: incluirDocumento,
      orderBy: [{ tipoDocumento: { codigo: 'asc' } }, { fechaEmision: 'asc' }],
    });
    if (documentos.length === 0) {
      throw new NotFoundException('No hay documentos disponibles para descargar');
    }
    await this.auditoria.registrar({
      accion: 'LEGAJO_DESCARGAR',
      entidad: 'trabajador',
      entidadId: trabajadorId,
      trabajadorId,
      usuarioId: sesion.usuarioId,
      cliente,
      detalle: { secciones, documentos: documentos.map((documento) => documento.id) },
    });

    const raiz = carpetaTrabajador(trabajador);
    await this.enviarZip(respuesta, raiz, this.entradas(documentos, (documento) => `${raiz}/${documento.tipoDocumento.seccion.carpeta}`));
  }

  async zipSeleccion(ids: string[], sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    const documentos = await this.prisma.documento.findMany({
      where: { id: { in: ids }, estado: 'DISPONIBLE', ...filtroVisibilidad(sesion) },
      include: {
        ...incluirDocumento,
        trabajador: { select: { numeroDoc: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true } },
      },
      orderBy: [{ trabajador: { apellidoPaterno: 'asc' } }, { tipoDocumento: { codigo: 'asc' } }, { fechaEmision: 'asc' }],
    });
    if (documentos.length === 0) {
      throw new NotFoundException('No hay documentos disponibles para descargar');
    }
    await this.auditoria.registrar({
      accion: 'DOCUMENTOS_DESCARGAR_SELECCION',
      entidad: 'documento',
      usuarioId: sesion.usuarioId,
      cliente,
      detalle: { documentos: documentos.map((documento) => documento.id) },
    });

    const raiz = `seleccion_${hoyEnLima()}`;
    const carpetas = new Map(documentos.map((documento) => [documento.trabajadorId, carpetaTrabajador(documento.trabajador)]));
    await this.enviarZip(
      respuesta,
      raiz,
      this.entradas(documentos, (documento) => `${raiz}/${carpetas.get(documento.trabajadorId) ?? ''}/${documento.tipoDocumento.seccion.carpeta}`),
    );
  }

  private entradas(documentos: DocumentoCompleto[], carpeta: (documento: DocumentoCompleto) => string): EntradaZip[] {
    const entradas: EntradaZip[] = [];
    for (const documento of documentos) {
      const archivo = documento.archivos.find((item) => item.id === documento.archivoActualId);
      if (archivo !== undefined) {
        entradas.push({ ruta: archivo.ruta, nombre: `${carpeta(documento)}/${nombreDescarga(documento)}` });
      }
    }
    return entradas;
  }

  private async enviarZip(respuesta: Response, nombreArchivo: string, entradas: EntradaZip[]): Promise<void> {
    respuesta.setHeader('Content-Type', 'application/zip');
    respuesta.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.zip"`);
    respuesta.setHeader('X-Accel-Buffering', 'no');

    const archivador = new ZipArchive({ store: true });
    const usados = new Map<string, number>();
    respuesta.on('close', () => {
      if (!respuesta.writableFinished) {
        void archivador.abort();
      }
    });
    archivador.on('error', () => respuesta.destroy());
    archivador.pipe(respuesta);
    for (const entrada of entradas) {
      const repeticion = (usados.get(entrada.nombre) ?? 0) + 1;
      usados.set(entrada.nombre, repeticion);
      const nombre = repeticion === 1 ? entrada.nombre : entrada.nombre.replace(/\.pdf$/, `_${repeticion}.pdf`);
      archivador.append(createReadStream(`${this.entorno.DIR_ARCHIVOS}/${entrada.ruta}`), { name: nombre, store: true });
    }
    await archivador.finalize();
  }

  async validar(datos: DocumentFieldsDto, sesion: SesionActiva, seccionId: number | null): Promise<DatosValidados> {
    const tipo = await this.prisma.tipoDocumento.findUnique({
      where: { id: datos.tipoDocumentoId },
      include: { seccion: true },
    });
    if (tipo === null || !tipo.activo) {
      throw new BadRequestException('El tipo de documento no existe o está inactivo');
    }
    if (tipo.codigo === CODIGO_FICHA_TEXTO) {
      throw new BadRequestException('La ficha de datos del servidor civil es solo texto y se completa en la Sección 01');
    }
    if (seccionId !== null && tipo.seccionId !== seccionId) {
      throw new BadRequestException('Solo se puede reclasificar dentro de la misma sección');
    }
    if (!seccionPermitida(sesion, tipo.seccion.numero)) {
      throw new ForbiddenException('No tienes permiso para registrar documentos en esta sección');
    }
    const verRestringidos = sesion.permisos.includes('documentos.restringidos');
    if (tipo.restringido && !verRestringidos) {
      throw new ForbiddenException('No tienes permiso para registrar documentos restringidos');
    }
    let nivel = datos.nivelAcceso;
    if (tipo.restringido && nivel === 'NORMAL') {
      nivel = 'RESTRINGIDO';
    }
    if (nivel === 'RESTRINGIDO' && !verRestringidos) {
      throw new ForbiddenException('No tienes permiso para marcar documentos como restringidos');
    }
    if (nivel === 'MUY_RESTRINGIDO' && !sesion.permisos.includes('documentos.muy_restringidos')) {
      throw new ForbiddenException('Solo el Administrador marca documentos como muy restringidos');
    }
    if (tipo.requiereNumero && datos.numero === null) {
      throw new BadRequestException('Este tipo de documento exige su número');
    }
    if (datos.fechaEmision !== null && datos.fechaEmision > hoyEnLima()) {
      throw new BadRequestException('La fecha de emisión no puede ser futura');
    }
    if (datos.fechaVencimiento !== null && datos.fechaEmision !== null && datos.fechaVencimiento < datos.fechaEmision) {
      throw new BadRequestException('El vencimiento no puede ser anterior a la emisión');
    }
    const campos = [...leerCampos(tipo.seccion.campos), ...leerCampos(tipo.campos)];
    const propios = validarDatos(campos, datos.datos);
    await this.exigirReferencias(referenciasACatalogo(campos, propios));
    return {
      tipoDocumentoId: tipo.id,
      numero: datos.numero,
      fechaEmision: datos.fechaEmision === null ? null : aFecha(datos.fechaEmision),
      fechaVencimiento: datos.fechaVencimiento === null ? null : aFecha(datos.fechaVencimiento),
      emisor: datos.emisor,
      observaciones: datos.observaciones,
      ubicacionFisica: datos.ubicacionFisica,
      nivelAcceso: nivel,
      datos: propios,
    };
  }

  async historial(id: string, sesion: SesionActiva): Promise<DocumentHistoryEntryDto[]> {
    await this.cargarVisible(id, sesion);
    const registros = await this.prisma.auditoria.findMany({
      where: { entidad: 'documento', entidadId: id, accion: { in: Object.keys(EVENTOS_DOCUMENTO) } },
      include: { usuario: { select: { nombreCompleto: true } } },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    });
    return registros.map((registro) => {
      const detalle = esquemaDetalle.safeParse(registro.detalle);
      const datos = detalle.success ? detalle.data : {};
      const antes = datos.antes ?? {};
      const despues = datos.despues ?? {};
      const cambios = Object.entries(CAMPOS_HISTORIAL)
        .filter(([clave]) => (antes[clave] ?? null) !== (despues[clave] ?? null))
        .map(([clave, campo]) => ({ campo, antes: antes[clave] ?? null, despues: despues[clave] ?? null }));
      return {
        fecha: registro.fecha.toISOString(),
        evento: EVENTOS_DOCUMENTO[registro.accion] ?? registro.accion,
        usuario: registro.usuario?.nombreCompleto ?? null,
        motivo: datos.motivo ?? null,
        cambios,
      };
    });
  }

  private async exigirReferencias(referencias: Record<CatalogoReferido, number[]>): Promise<void> {
    const [regimenes, areas, cargos] = await Promise.all([
      this.prisma.regimen.count({ where: { id: { in: referencias.regimen }, activo: true } }),
      this.prisma.area.count({ where: { id: { in: referencias.area }, activo: true } }),
      this.prisma.cargo.count({ where: { id: { in: referencias.cargo }, activo: true } }),
    ]);
    if (regimenes !== new Set(referencias.regimen).size) {
      throw new BadRequestException('El régimen elegido no existe o está inactivo');
    }
    if (areas !== new Set(referencias.area).size) {
      throw new BadRequestException('El área elegida no existe o está inactiva');
    }
    if (cargos !== new Set(referencias.cargo).size) {
      throw new BadRequestException('El cargo elegido no existe o está inactivo');
    }
  }

  private async exigirSubida(subidaId: string, sesion: SesionActiva): Promise<string> {
    const subida = await this.subidas.obtener(subidaId);
    if (subida === null || subida.metadata?.['usuario'] !== sesion.usuarioId) {
      throw new BadRequestException('No se encontró el archivo subido. Vuelve a seleccionarlo.');
    }
    if (subida.size === undefined || subida.offset !== subida.size) {
      throw new BadRequestException('El archivo todavía no termina de subirse');
    }
    const enUso = await this.prisma.documento.count({ where: { subidaPendiente: subidaId } });
    if (enUso > 0) {
      throw new ConflictException('Ese archivo ya está registrado en un documento');
    }
    return subida.metadata['filename'] ?? 'documento.pdf';
  }

  private exigirEditable(documento: DocumentoCompleto, sesion: SesionActiva): void {
    if (documento.estado === 'ANULADO' || documento.estado === 'PROCESANDO') {
      throw new BadRequestException(
        documento.estado === 'ANULADO' ? 'Un documento anulado no se modifica' : 'Espera a que termine de procesarse',
      );
    }
    if (!puedeEditar(documento, sesion)) {
      throw new ForbiddenException('Solo puedes corregir documentos que subiste en las últimas 48 horas');
    }
  }

  private async cargarVisible(id: string, sesion: SesionActiva): Promise<DocumentoCompleto> {
    const documento = await this.prisma.documento.findFirst({
      where: { id, ...filtroVisibilidad(sesion) },
      include: incluirDocumento,
    });
    if (documento === null) {
      throw new NotFoundException('El documento no existe');
    }
    return documento;
  }

  private async exigirTrabajador(id: string): Promise<void> {
    if ((await this.prisma.trabajador.count({ where: { id } })) === 0) {
      throw new NotFoundException('El trabajador no existe');
    }
  }

  private resumen(documento: DocumentoCompleto): Record<string, string | null> {
    return {
      tipo: documento.tipoDocumento.codigo,
      numero: documento.numero,
      fechaEmision: aTextoOpcional(documento.fechaEmision),
      fechaVencimiento: aTextoOpcional(documento.fechaVencimiento),
      emisor: documento.emisor,
      observaciones: documento.observaciones,
      ubicacionFisica: documento.ubicacionFisica,
      nivelAcceso: documento.nivelAcceso,
      datos: JSON.stringify(documento.datos),
    };
  }
}
