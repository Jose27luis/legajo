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
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ENTORNO, type Entorno } from '../environment/environment';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aFecha, hoyEnLima } from '../common/dates';
import { aTipoDto } from '../catalogs/document-types.service';
import { leerCampos, validarDatos } from '../catalogs/section-fields';
import type { CreateDocumentDto, DocumentFieldsDto, ReplaceDocumentDto, UpdateDocumentDto, VoidDocumentDto } from './dto/document-input.dto';
import type { DocumentDto, LegajoDto, LegajoSectionDto } from './dto/document.dto';
import {
  aDocumentoDto,
  filtroVisibilidad,
  incluirDocumento,
  nombreDescarga,
  puedeEditar,
  slug,
  type DocumentoCompleto,
} from './document.mapper';
import { DocumentQueueService } from './document-queue.service';
import { UploadServerService } from './upload-server.service';

export interface ArchivoParaEntregar {
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
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async secciones(sesion: SesionActiva): Promise<LegajoSectionDto[]> {
    const verRestringidos = sesion.permisos.includes('documentos.restringidos');
    const secciones = await this.prisma.seccion.findMany({
      orderBy: { numero: 'asc' },
      include: {
        tipos: {
          where: { activo: true, ...(verRestringidos ? {} : { restringido: false }) },
          orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
        },
      },
    });
    return secciones.map((seccion) => ({
      id: seccion.id,
      numero: seccion.numero,
      nombre: seccion.nombre,
      descripcion: seccion.descripcion,
      campos: leerCampos(seccion.campos),
      tipos: seccion.tipos.map(aTipoDto),
      total: 0,
    }));
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
    return documento;
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

    const raiz = slug(`${trabajador.numeroDoc}_${trabajador.apellidoPaterno}_${trabajador.apellidoMaterno ?? ''}_${trabajador.nombres}`, 90).toUpperCase();
    respuesta.setHeader('Content-Type', 'application/zip');
    respuesta.setHeader('Content-Disposition', `attachment; filename="${raiz}.zip"`);
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
    for (const documento of documentos) {
      const archivo = documento.archivos.find((item) => item.id === documento.archivoActualId);
      if (archivo === undefined) {
        continue;
      }
      const base = `${raiz}/${documento.tipoDocumento.seccion.carpeta}/${nombreDescarga(documento)}`;
      const repeticion = (usados.get(base) ?? 0) + 1;
      usados.set(base, repeticion);
      const nombre = repeticion === 1 ? base : base.replace(/\.pdf$/, `_${repeticion}.pdf`);
      archivador.append(createReadStream(`${this.entorno.DIR_ARCHIVOS}/${archivo.ruta}`), { name: nombre, store: true });
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
    if (seccionId !== null && tipo.seccionId !== seccionId) {
      throw new BadRequestException('Solo se puede reclasificar dentro de la misma sección');
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
    return {
      tipoDocumentoId: tipo.id,
      numero: datos.numero,
      fechaEmision: datos.fechaEmision === null ? null : aFecha(datos.fechaEmision),
      fechaVencimiento: datos.fechaVencimiento === null ? null : aFecha(datos.fechaVencimiento),
      emisor: datos.emisor,
      observaciones: datos.observaciones,
      ubicacionFisica: datos.ubicacionFisica,
      nivelAcceso: nivel,
      datos: validarDatos(leerCampos(tipo.seccion.campos), datos.datos),
    };
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
      fechaEmision: documento.fechaEmision === null ? null : documento.fechaEmision.toISOString().slice(0, 10),
      nivelAcceso: documento.nivelAcceso,
    };
  }
}
