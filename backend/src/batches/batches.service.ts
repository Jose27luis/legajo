import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { ENTORNO, type Entorno } from '../environment/environment';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { hoyEnLima } from '../common/dates';
import { nombreTrabajador } from '../common/names';
import { leerCampos } from '../catalogs/section-fields';
import { rutaSubida } from '../documents/document-queue';
import type { DocumentFieldsDto } from '../documents/dto/document-input.dto';
import type { LegajoSectionDto } from '../documents/dto/document.dto';
import { DocumentsService, type DatosValidados } from '../documents/documents.service';
import { ejecutar } from '../documents/pdf-tools';
import { UploadServerService } from '../documents/upload-server.service';
import { bloquearLote, recalcularLote } from './batch-counters';
import { interpretarNombre, type NombreInterpretado } from './batch-names';
import { CODIGO_FICHA_TEXTO } from '../seed-catalogs';
import type {
  ClassifyItemDto,
  CreateBatchDto,
  DeleteItemDto,
  DiscardItemDto,
  SplitItemDto,
  UploadedItemDto,
} from './dto/batch-input.dto';
import type { BatchDetailDto, BatchDto, BatchItemDto, BatchWorkerDto, DeleteItemResultDto, PreviewItemDto } from './dto/batch.dto';

const LOTES_LISTADOS = 60;

const incluirItem = {
  trabajador: { select: { id: true, numeroDoc: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true } },
  tipoDocumento: { select: { id: true, codigo: true, nombre: true, seccion: { select: { numero: true } } } },
  documentos: { select: { id: true, estado: true, trabajadorId: true, tipoDocumento: { select: { seccion: { select: { numero: true } } } } } },
} as const satisfies Prisma.LoteItemInclude;

type ItemCompleto = Prisma.LoteItemGetPayload<{ include: typeof incluirItem }>;
type LoteConUsuario = Prisma.LoteCargaGetPayload<{ include: { usuario: { select: { nombreCompleto: true } } } }>;

interface TrabajadorBreve {
  id: string;
  numeroDoc: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
}

interface TipoBreve {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
  restringido: boolean;
  requiereNumero: boolean;
  accion: 'NINGUNA' | 'VINCULO' | 'MOVIMIENTO' | 'CESE';
  seccion: { numero: number; campos: Prisma.JsonValue };
}

interface Diagnostico {
  interpretado: NombreInterpretado | null;
  trabajador: TrabajadorBreve | null;
  tipo: TipoBreve | null;
  motivo: string | null;
}

interface Archivo {
  ruta: string;
  nombre: string;
}

function aTrabajadorDto(trabajador: TrabajadorBreve | null): BatchWorkerDto | null {
  return trabajador === null ? null : { id: trabajador.id, numeroDoc: trabajador.numeroDoc, nombre: nombreTrabajador(trabajador) };
}

function mensaje(error: unknown): string {
  if (error instanceof HttpException) {
    return error.message.slice(0, 300);
  }
  throw error;
}

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
    private readonly documentos: DocumentsService,
    private readonly subidas: UploadServerService,
    private readonly autenticacion: AuthService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async secciones(sesion: SesionActiva): Promise<LegajoSectionDto[]> {
    return this.documentos.secciones(sesion);
  }

  async previsualizar(nombres: string[], sesion: SesionActiva): Promise<PreviewItemDto[]> {
    const diagnosticos = await this.diagnosticar(nombres, sesion);
    return diagnosticos.map((diagnostico, indice) => ({
      nombre: nombres[indice],
      reconocido: diagnostico.motivo === null,
      motivo: diagnostico.motivo,
      trabajador: aTrabajadorDto(diagnostico.trabajador),
      tipo:
        diagnostico.tipo === null
          ? null
          : { id: diagnostico.tipo.id, codigo: diagnostico.tipo.codigo, nombre: diagnostico.tipo.nombre, seccion: diagnostico.tipo.seccion.numero },
      numero: diagnostico.interpretado?.numero ?? null,
      fechaEmision: diagnostico.interpretado?.fechaEmision ?? null,
    }));
  }

  async listar(sesion: SesionActiva): Promise<BatchDto[]> {
    const lotes = await this.prisma.loteCarga.findMany({
      orderBy: { creadoEn: 'desc' },
      take: LOTES_LISTADOS,
      include: { usuario: { select: { nombreCompleto: true } } },
    });
    return lotes.map((lote) => this.aLoteDto(lote, sesion));
  }

  async detalle(id: string, sesion: SesionActiva): Promise<BatchDetailDto> {
    const lote = await this.prisma.loteCarga.findUnique({
      where: { id },
      include: { usuario: { select: { nombreCompleto: true } }, items: { orderBy: { orden: 'asc' }, include: incluirItem } },
    });
    if (lote === null) {
      throw new NotFoundException('El lote no existe');
    }
    return { ...this.aLoteDto(lote, sesion), items: lote.items.map((item) => this.aItemDto(item)) };
  }

  async crear(datos: CreateBatchDto, sesion: SesionActiva, cliente: DatosCliente): Promise<BatchDetailDto> {
    const lote = await this.prisma.$transaction(async (transaccion) => {
      const creado = await transaccion.loteCarga.create({
        data: {
          usuarioId: sesion.usuarioId,
          total: datos.archivos.length,
          items: {
            create: datos.archivos.map((archivo, indice) => ({
              orden: indice + 1,
              nombreArchivo: archivo.nombre.slice(0, 255),
              tamano: BigInt(archivo.tamano),
            })),
          },
        },
      });
      await this.auditoria.registrar(
        {
          accion: 'LOTE_CREAR',
          entidad: 'lote_carga',
          entidadId: creado.id,
          usuarioId: sesion.usuarioId,
          cliente,
          detalle: { archivos: datos.archivos.length },
        },
        transaccion,
      );
      return creado;
    });
    return this.detalle(lote.id, sesion);
  }

  async subido(loteId: string, itemId: string, datos: UploadedItemDto, sesion: SesionActiva, cliente: DatosCliente): Promise<BatchItemDto> {
    const item = await this.cargarItem(loteId, itemId);
    const lote = await this.prisma.loteCarga.findUniqueOrThrow({ where: { id: loteId }, select: { usuarioId: true } });
    if (lote.usuarioId !== sesion.usuarioId) {
      throw new ForbiddenException('Solo quien creó el lote puede subir sus archivos');
    }
    if (item.estado !== 'SUBIENDO') {
      if (item.subidaId === datos.subidaId) {
        return this.aItemDto(item);
      }
      throw new ConflictException('Este archivo del lote ya fue registrado');
    }
    const subida = await this.subidas.obtener(datos.subidaId);
    if (subida === null || subida.metadata?.['usuario'] !== sesion.usuarioId) {
      throw new BadRequestException('No se encontró el archivo subido');
    }
    if (subida.size === undefined || subida.offset !== subida.size) {
      throw new BadRequestException('El archivo todavía no termina de subirse');
    }

    const [diagnostico] = await this.diagnosticar([item.nombreArchivo], sesion);
    let validados: DatosValidados | null = null;
    let motivo = diagnostico.motivo;
    if (motivo === null && diagnostico.tipo !== null && diagnostico.interpretado !== null) {
      try {
        validados = await this.documentos.validar(this.camposDesdeNombre(diagnostico.tipo.id, diagnostico.interpretado), sesion, null);
      } catch (error: unknown) {
        motivo = mensaje(error);
      }
    }

    const resultado = await this.prisma.$transaction(async (transaccion) => {
      await bloquearLote(transaccion, loteId);
      const vigente = await transaccion.loteItem.findUniqueOrThrow({ where: { id: itemId } });
      if (vigente.estado !== 'SUBIENDO') {
        throw new ConflictException('Este archivo del lote ya fue registrado');
      }
      let documentoId: string | null = null;
      if (validados !== null && diagnostico.trabajador !== null) {
        const documento = await this.documentos.crearDocumento(transaccion, {
          trabajadorId: diagnostico.trabajador.id,
          validados,
          subidaId: datos.subidaId,
          nombreOriginal: item.nombreArchivo,
          sesion,
          cliente,
          loteItemId: itemId,
          vinculoId: null,
        });
        documentoId = documento.id;
      }
      await transaccion.loteItem.update({
        where: { id: itemId },
        data: {
          subidaId: datos.subidaId,
          trabajadorId: diagnostico.trabajador?.id ?? null,
          tipoDocumentoId: diagnostico.tipo?.id ?? null,
          estado: documentoId === null ? 'PENDIENTE' : 'CLASIFICADO',
          motivo: documentoId === null ? (motivo ?? 'No se pudo clasificar').slice(0, 300) : null,
        },
      });
      await recalcularLote(transaccion, loteId);
      return documentoId;
    });
    if (resultado !== null) {
      await this.documentos.encolar(resultado, datos.subidaId, item.nombreArchivo, sesion.usuarioId);
    }
    return this.aItemDto(await this.cargarItem(loteId, itemId));
  }

  async archivo(loteId: string, itemId: string): Promise<Archivo> {
    const item = await this.cargarItem(loteId, itemId);
    if (item.estado !== 'PENDIENTE' || item.subidaId === null) {
      throw new NotFoundException('Este archivo ya no está en la bandeja');
    }
    return { ruta: item.subidaId, nombre: item.nombreArchivo };
  }

  async clasificar(loteId: string, itemId: string, datos: ClassifyItemDto, sesion: SesionActiva, cliente: DatosCliente): Promise<BatchItemDto> {
    const item = await this.exigirPendiente(loteId, itemId);
    const subidaId = item.subidaId ?? '';
    await this.exigirTrabajador(datos.trabajadorId);
    const validados = await this.documentos.validar(datos, sesion, null);
    const documentoId = await this.prisma.$transaction(async (transaccion) => {
      await this.bloquearPendiente(transaccion, loteId, itemId);
      const documento = await this.documentos.crearDocumento(transaccion, {
        trabajadorId: datos.trabajadorId,
        validados,
        subidaId,
        nombreOriginal: item.nombreArchivo,
        sesion,
        cliente,
        loteItemId: itemId,
        vinculoId: null,
      });
      await transaccion.loteItem.update({
        where: { id: itemId },
        data: { estado: 'CLASIFICADO', motivo: null, trabajadorId: datos.trabajadorId, tipoDocumentoId: validados.tipoDocumentoId },
      });
      await this.auditoria.registrar(
        {
          accion: 'LOTE_ITEM_CLASIFICAR',
          entidad: 'lote_item',
          entidadId: itemId,
          trabajadorId: datos.trabajadorId,
          usuarioId: sesion.usuarioId,
          cliente,
          detalle: { lote: loteId, archivo: item.nombreArchivo, documento: documento.id },
        },
        transaccion,
      );
      await recalcularLote(transaccion, loteId);
      return documento.id;
    });
    await this.documentos.encolar(documentoId, subidaId, item.nombreArchivo, sesion.usuarioId);
    return this.aItemDto(await this.cargarItem(loteId, itemId));
  }

  async dividir(loteId: string, itemId: string, datos: SplitItemDto, sesion: SesionActiva, cliente: DatosCliente): Promise<BatchItemDto> {
    const item = await this.exigirPendiente(loteId, itemId);
    const original = rutaSubida(this.entorno.DIR_SUBIDAS, item.subidaId ?? '');
    const paginas = await this.contarPaginas(original);
    const ordenadas = [...datos.partes].sort((a, b) => a.desde - b.desde);
    ordenadas.forEach((parte, indice) => {
      if (parte.desde > parte.hasta || parte.hasta > paginas) {
        throw new BadRequestException(`El rango ${parte.desde}-${parte.hasta} no es válido: el PDF tiene ${paginas} páginas`);
      }
      const anterior = ordenadas.at(indice - 1);
      if (indice > 0 && anterior !== undefined && parte.desde <= anterior.hasta) {
        throw new BadRequestException(`Los rangos ${anterior.desde}-${anterior.hasta} y ${parte.desde}-${parte.hasta} se cruzan`);
      }
    });
    const validadas: Array<{ trabajadorId: string; validados: DatosValidados; desde: number; hasta: number }> = [];
    for (const parte of ordenadas) {
      await this.exigirTrabajador(parte.trabajadorId);
      validadas.push({ trabajadorId: parte.trabajadorId, validados: await this.documentos.validar(parte, sesion, null), desde: parte.desde, hasta: parte.hasta });
    }

    const piezas: Array<{ subidaId: string; nombre: string }> = [];
    try {
      for (const parte of validadas) {
        const subidaId = randomBytes(16).toString('hex');
        const resultado = await ejecutar('qpdf', [
          '--empty',
          '--pages',
          original,
          `${parte.desde}-${parte.hasta}`,
          '--',
          rutaSubida(this.entorno.DIR_SUBIDAS, subidaId),
        ]);
        piezas.push({ subidaId, nombre: item.nombreArchivo.replace(/\.pdf$/i, `_p${parte.desde}-${parte.hasta}.pdf`) });
        if (resultado.codigo !== 0 && resultado.codigo !== 3) {
          throw new BadRequestException('No se pudo dividir el PDF');
        }
      }
      const creados = await this.prisma.$transaction(async (transaccion) => {
        await this.bloquearPendiente(transaccion, loteId, itemId);
        const ids: string[] = [];
        for (const [indice, parte] of validadas.entries()) {
          const documento = await this.documentos.crearDocumento(transaccion, {
            trabajadorId: parte.trabajadorId,
            validados: parte.validados,
            subidaId: piezas[indice].subidaId,
            nombreOriginal: piezas[indice].nombre,
            sesion,
            cliente,
            loteItemId: itemId,
            vinculoId: null,
          });
          ids.push(documento.id);
        }
        await transaccion.loteItem.update({ where: { id: itemId }, data: { estado: 'DIVIDIDO', motivo: null } });
        await this.auditoria.registrar(
          {
            accion: 'LOTE_ITEM_DIVIDIR',
            entidad: 'lote_item',
            entidadId: itemId,
            usuarioId: sesion.usuarioId,
            cliente,
            detalle: {
              lote: loteId,
              archivo: item.nombreArchivo,
              partes: validadas.map((parte, indice) => ({ desde: parte.desde, hasta: parte.hasta, trabajador: parte.trabajadorId, documento: ids[indice] })),
            },
          },
          transaccion,
        );
        await recalcularLote(transaccion, loteId);
        return ids;
      });
      for (const [indice, documentoId] of creados.entries()) {
        await this.documentos.encolar(documentoId, piezas[indice].subidaId, piezas[indice].nombre, sesion.usuarioId);
      }
    } catch (error: unknown) {
      await Promise.all(piezas.map((pieza) => rm(rutaSubida(this.entorno.DIR_SUBIDAS, pieza.subidaId), { force: true })));
      throw error;
    }
    await this.borrarSubida(item.subidaId);
    return this.aItemDto(await this.cargarItem(loteId, itemId));
  }

  async descartar(loteId: string, itemId: string, datos: DiscardItemDto, sesion: SesionActiva, cliente: DatosCliente): Promise<BatchItemDto> {
    const item = await this.cargarItem(loteId, itemId);
    if (item.estado !== 'PENDIENTE' && item.estado !== 'SUBIENDO') {
      throw new BadRequestException('Solo se descartan archivos pendientes');
    }
    await this.prisma.$transaction(async (transaccion) => {
      await bloquearLote(transaccion, loteId);
      const vigente = await transaccion.loteItem.findUniqueOrThrow({ where: { id: itemId } });
      if (vigente.estado !== 'PENDIENTE' && vigente.estado !== 'SUBIENDO') {
        throw new ConflictException('Otro usuario ya atendió este archivo');
      }
      await transaccion.loteItem.update({ where: { id: itemId }, data: { estado: 'ERROR', motivo: `Descartado: ${datos.motivo}`.slice(0, 300) } });
      await this.auditoria.registrar(
        {
          accion: 'LOTE_ITEM_DESCARTAR',
          entidad: 'lote_item',
          entidadId: itemId,
          usuarioId: sesion.usuarioId,
          cliente,
          detalle: { lote: loteId, archivo: item.nombreArchivo, motivo: datos.motivo },
        },
        transaccion,
      );
      await recalcularLote(transaccion, loteId);
    });
    await this.borrarSubida(item.subidaId);
    return this.aItemDto(await this.cargarItem(loteId, itemId));
  }

  async eliminarItem(
    loteId: string,
    itemId: string,
    datos: DeleteItemDto,
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<DeleteItemResultDto> {
    const item = await this.cargarItem(loteId, itemId);
    await this.autenticacion.confirmarClave(sesion, datos.clave, cliente);
    const eliminable =(estado: string) => estado === 'PENDIENTE' || estado === 'SUBIENDO' || estado === 'ERROR';
    if (!eliminable(item.estado)) {
      throw new BadRequestException('Este archivo ya está en el legajo: elimínalo desde la sección del trabajador');
    }
    const loteEliminado = await this.prisma.$transaction(async (transaccion) => {
      await bloquearLote(transaccion, loteId);
      const vigente = await transaccion.loteItem.findUniqueOrThrow({
        where: { id: itemId },
        select: { estado: true, _count: { select: { documentos: true } } },
      });
      if (!eliminable(vigente.estado) || vigente._count.documentos > 0) {
        throw new ConflictException('Otro usuario ya clasificó este archivo');
      }
      await transaccion.loteItem.delete({ where: { id: itemId } });
      await this.auditoria.registrar(
        {
          accion: 'LOTE_ITEM_ELIMINAR',
          entidad: 'lote_item',
          entidadId: itemId,
          usuarioId: sesion.usuarioId,
          cliente,
          detalle: { lote: loteId, archivo: item.nombreArchivo, estado: vigente.estado, motivo: datos.motivo },
        },
        transaccion,
      );
      const restantes = await transaccion.loteItem.count({ where: { loteId } });
      if (restantes === 0) {
        await transaccion.loteCarga.delete({ where: { id: loteId } });
        await this.auditoria.registrar(
          {
            accion: 'LOTE_ELIMINAR',
            entidad: 'lote',
            entidadId: loteId,
            usuarioId: sesion.usuarioId,
            cliente,
            detalle: { motivo: 'Se eliminó su último archivo' },
          },
          transaccion,
        );
        return true;
      }
      await recalcularLote(transaccion, loteId);
      await transaccion.loteCarga.update({ where: { id: loteId }, data: { total: restantes } });
      return false;
    });
    await this.borrarSubida(item.subidaId);
    return { loteEliminado };
  }

  private async diagnosticar(nombres: string[], sesion: SesionActiva): Promise<Diagnostico[]> {
    const interpretados = nombres.map(interpretarNombre);
    const documentos = [...new Set(interpretados.flatMap((item) => (item === null ? [] : [item.numeroDoc])))];
    const codigos = [...new Set(interpretados.flatMap((item) => (item === null ? [] : [item.codigo])))];
    const [trabajadores, tipos] = await Promise.all([
      this.prisma.trabajador.findMany({
        where: { numeroDoc: { in: documentos } },
        select: { id: true, numeroDoc: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true },
      }),
      this.prisma.tipoDocumento.findMany({
        where: { codigo: { in: codigos } },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          activo: true,
          restringido: true,
          requiereNumero: true,
          accion: true,
          seccion: { select: { numero: true, campos: true } },
        },
      }),
    ]);
    const hoy = hoyEnLima();
    return interpretados.map((interpretado) => {
      if (interpretado === null) {
        return { interpretado, trabajador: null, tipo: null, motivo: 'El nombre no sigue la convención DNI_CÓDIGO_NÚMERO_FECHA' };
      }
      const trabajador = trabajadores.find((item) => item.numeroDoc === interpretado.numeroDoc) ?? null;
      const tipo = tipos.find((item) => item.codigo === interpretado.codigo) ?? null;
      let motivo: string | null = null;
      if (trabajador === null) {
        motivo = `No hay un trabajador registrado con el documento ${interpretado.numeroDoc}`;
      } else if (tipo === null || !tipo.activo || tipo.codigo === CODIGO_FICHA_TEXTO) {
        motivo = `El código ${interpretado.codigo} no corresponde a un tipo de documento activo`;
      } else if (tipo.restringido && !sesion.permisos.includes('documentos.restringidos')) {
        motivo = 'El tipo es restringido y tu cuenta no puede registrarlo';
      } else if (tipo.requiereNumero && interpretado.numero === null) {
        motivo = 'Este tipo exige el número del documento y el nombre no lo trae';
      } else if (interpretado.fechaEmision !== null && interpretado.fechaEmision > hoy) {
        motivo = 'La fecha del nombre es futura';
      } else if (leerCampos(tipo.seccion.campos).some((campo) => campo.obligatorio)) {
        motivo = 'La sección pide datos que no vienen en el nombre';
      } else if (tipo.accion === 'VINCULO') {
        motivo = 'Los contratos y resoluciones necesitan el tipo de incorporación, el régimen y el inicio del vínculo';
      } else if (sesion.seccionesRestringidas.includes(tipo.seccion.numero)) {
        motivo = 'Tu cuenta no tiene acceso a esta sección';
      }
      return { interpretado, trabajador, tipo, motivo };
    });
  }

  private camposDesdeNombre(tipoDocumentoId: number, interpretado: NombreInterpretado): DocumentFieldsDto {
    return {
      tipoDocumentoId,
      numero: interpretado.numero,
      fechaEmision: interpretado.fechaEmision,
      fechaVencimiento: null,
      emisor: null,
      observaciones: null,
      ubicacionFisica: null,
      nivelAcceso: 'NORMAL',
      datos: {},
    };
  }

  private async contarPaginas(ruta: string): Promise<number> {
    const resultado = await ejecutar('qpdf', ['--show-npages', ruta]);
    const paginas = Number(resultado.salida.trim());
    if (resultado.codigo !== 0 || !Number.isInteger(paginas) || paginas < 1) {
      throw new BadRequestException('No se pudieron leer las páginas del PDF');
    }
    return paginas;
  }

  private async exigirPendiente(loteId: string, itemId: string): Promise<ItemCompleto> {
    const item = await this.cargarItem(loteId, itemId);
    if (item.estado !== 'PENDIENTE' || item.subidaId === null) {
      throw new BadRequestException('Este archivo ya no está pendiente');
    }
    if ((await this.subidas.obtener(item.subidaId)) === null) {
      throw new BadRequestException('El archivo ya no está disponible. Descártalo y vuelve a subirlo.');
    }
    return item;
  }

  private async bloquearPendiente(transaccion: Prisma.TransactionClient, loteId: string, itemId: string): Promise<void> {
    await bloquearLote(transaccion, loteId);
    const vigente = await transaccion.loteItem.findUniqueOrThrow({ where: { id: itemId } });
    if (vigente.estado !== 'PENDIENTE') {
      throw new ConflictException('Otro usuario ya atendió este archivo');
    }
  }

  private async exigirTrabajador(id: string): Promise<void> {
    if ((await this.prisma.trabajador.count({ where: { id } })) === 0) {
      throw new BadRequestException('El trabajador no existe');
    }
  }

  private async cargarItem(loteId: string, itemId: string): Promise<ItemCompleto> {
    const item = await this.prisma.loteItem.findFirst({ where: { id: itemId, loteId }, include: incluirItem });
    if (item === null) {
      throw new NotFoundException('El archivo no pertenece a este lote');
    }
    return item;
  }

  private async borrarSubida(subidaId: string | null): Promise<void> {
    if (subidaId !== null) {
      await this.subidas.almacen.remove(subidaId).catch(() => undefined);
    }
  }

  private aLoteDto(lote: LoteConUsuario, sesion: SesionActiva): BatchDto {
    return {
      id: lote.id,
      estado: lote.estado,
      total: lote.total,
      clasificados: lote.clasificados,
      pendientes: lote.pendientes,
      conError: lote.conError,
      creadoPor: lote.usuario.nombreCompleto,
      creadoEn: lote.creadoEn.toISOString(),
      terminadoEn: lote.terminadoEn === null ? null : lote.terminadoEn.toISOString(),
      propio: lote.usuarioId === sesion.usuarioId,
    };
  }

  private aItemDto(item: ItemCompleto): BatchItemDto {
    return {
      id: item.id,
      orden: item.orden,
      nombreArchivo: item.nombreArchivo,
      tamano: Number(item.tamano),
      estado: item.estado,
      motivo: item.motivo,
      trabajador: aTrabajadorDto(item.trabajador),
      tipo:
        item.tipoDocumento === null
          ? null
          : {
              id: item.tipoDocumento.id,
              codigo: item.tipoDocumento.codigo,
              nombre: item.tipoDocumento.nombre,
              seccion: item.tipoDocumento.seccion.numero,
            },
      documentos: item.documentos.map((documento) => ({
        id: documento.id,
        estado: documento.estado,
        seccion: documento.tipoDocumento.seccion.numero,
        trabajadorId: documento.trabajadorId,
      })),
    };
  }
}
