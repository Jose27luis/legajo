import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aFecha, aTexto, diaAnterior, diaSiguiente, hoyEnLima } from '../common/dates';
import { leerDatosGuardados, type ValorCampo } from '../catalogs/section-fields';
import { aDocumentoDto, filtroVisibilidad, incluirDocumento, type DocumentoCompleto } from '../documents/document.mapper';
import type { DocumentDto } from '../documents/dto/document.dto';
import { exigirCatalogosActivos } from '../workers/catalog-guard';
import { TEXTO_MOTIVO_CESE, TEXTO_MOVIMIENTO } from '../workers/labels';
import type { MotivoCambioValor as MotivoCambio } from '../workers/dto/worker.dto';
import type { CeseInputDto, MovementInputDto } from './dto/labor-input.dto';
import { ContractExpiryService, type ActorVencimiento } from './contract-expiry.service';

export const INCORPORACION = {
  PRIMER_INGRESO: 'Primer ingreso',
  REINGRESO: 'Reingreso',
  RENOVACION: 'Renovación o continuidad',
} as const;

interface DatosVinculo {
  tipoIncorporacion: string;
  regimenId: number;
  inicio: string;
  fin: string | null;
  areaId: number | null;
  cargoId: number | null;
}

type LecturaVinculo = Omit<DatosVinculo, 'inicio'> & { inicio: string | null };

export interface NuevoMovimiento {
  tipo: MovementInputDto['tipo'];
  fecha: string;
  areaOrigenId: number;
  areaDestinoId: number;
  observacion: string | null;
  documentoId: string | null;
}

const incluirTrabajador = {
  vinculos: { orderBy: [{ fechaInicio: 'desc' }, { creadoEn: 'desc' }] },
} as const satisfies Prisma.TrabajadorInclude;

type TrabajadorConVinculos = Prisma.TrabajadorGetPayload<{ include: typeof incluirTrabajador }>;
type Vinculo = TrabajadorConVinculos['vinculos'][number];

function texto(valor: ValorCampo | undefined): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

function numero(valor: ValorCampo | undefined): number | null {
  return typeof valor === 'number' ? valor : null;
}

function referencia(documento: DocumentoCompleto): string {
  return `${documento.tipoDocumento.nombre} N.º ${documento.numero ?? 'sin número'}`.slice(0, 160);
}

const MOTIVOS_TRANSICION: ReadonlySet<string> = new Set(['CAMBIO_REGIMEN', 'CAMBIO_CARGO_O_AREA', 'RENOVACION']);

function actor(sesion: SesionActiva, cliente: DatosCliente): ActorVencimiento {
  return { usuarioId: sesion.usuarioId, cliente };
}

@Injectable()
export class LaborService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
    private readonly vencimientos: ContractExpiryService,
  ) {}

  async alRegistrar(
    transaccion: Prisma.TransactionClient,
    documento: DocumentoCompleto,
    vinculoElegido: string | null,
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<void> {
    if (documento.tipoDocumento.accion !== 'VINCULO') {
      if (vinculoElegido !== null) {
        throw new BadRequestException('Solo un contrato, adenda o resolución de nombramiento sustenta un vínculo laboral');
      }
      return;
    }
    await this.registrarVinculo(transaccion, documento, vinculoElegido, sesion, cliente);
    await this.extenderPeriodo(transaccion, documento.id, sesion, cliente);
    await this.vencimientos.vencer(transaccion, documento.trabajadorId, actor(sesion, cliente));
  }

  async alEditar(transaccion: Prisma.TransactionClient, documento: DocumentoCompleto, sesion: SesionActiva, cliente: DatosCliente): Promise<void> {
    if (documento.tipoDocumento.accion !== 'VINCULO' || documento.vinculoId === null) {
      return;
    }
    await this.extenderPeriodo(transaccion, documento.id, sesion, cliente);
    await this.vencimientos.vencer(transaccion, documento.trabajadorId, actor(sesion, cliente));
  }

  private async extenderPeriodo(
    transaccion: Prisma.TransactionClient,
    documentoId: string,
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<void> {
    const vigente = await transaccion.documento.findUnique({ where: { id: documentoId }, select: { vinculoId: true } });
    if (vigente?.vinculoId != null) {
      await this.vencimientos.extender(transaccion, vigente.vinculoId, actor(sesion, cliente), documentoId);
    }
  }

  async alEliminar(
    transaccion: Prisma.TransactionClient,
    documento: DocumentoCompleto,
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<boolean> {
    if (documento.tipoDocumento.accion !== 'VINCULO' || documento.vinculoId === null) {
      return false;
    }
    const vinculoId = documento.vinculoId;
    const otrosSustentos = await transaccion.documento.count({
      where: { id: { not: documento.id }, vinculoId, estado: { not: 'ANULADO' }, tipoDocumento: { accion: 'VINCULO' } },
    });
    if (otrosSustentos > 0) {
      return false;
    }
    const trabajador = await this.trabajador(transaccion, documento.trabajadorId);
    const eliminado = trabajador.vinculos.find((vinculo) => vinculo.id === vinculoId);
    if (eliminado === undefined) {
      return false;
    }
    await transaccion.documento.updateMany({ where: { vinculoId }, data: { vinculoId: null } });
    await transaccion.vinculo.delete({ where: { id: vinculoId } });
    await this.anotar(transaccion, 'VINCULO_ELIMINAR', 'vinculo', vinculoId, trabajador.id, sesion, cliente, {
      documento: documento.id,
      fechaInicio: aTexto(eliminado.fechaInicio),
      fechaFin: eliminado.fechaFin === null ? null : aTexto(eliminado.fechaFin),
      motivoFin: eliminado.motivoFin,
      regimen: eliminado.regimenId,
      cargo: eliminado.cargoId,
      area: eliminado.areaId,
      tipoPersonal: eliminado.tipoPersonal,
      referencia: eliminado.referencia,
      actual: eliminado.actual,
    });
    if (!eliminado.actual) {
      return true;
    }
    const siguiente = trabajador.vinculos.find((vinculo) => vinculo.id !== vinculoId);
    if (siguiente === undefined) {
      await transaccion.trabajador.update({
        where: { id: trabajador.id },
        data: { estado: 'CESADO', movimientoActual: 'SIN_MOVIMIENTO', movimientoFecha: null },
      });
      return true;
    }
    const reabrir = siguiente.motivoFin !== null && MOTIVOS_TRANSICION.has(siguiente.motivoFin);
    await transaccion.vinculo.update({
      where: { id: siguiente.id },
      data: reabrir ? { actual: true, fechaFin: null, motivoFin: null } : { actual: true },
    });
    await transaccion.trabajador.update({
      where: { id: trabajador.id },
      data: {
        estado: reabrir || siguiente.fechaFin === null ? 'ACTIVO' : 'CESADO',
        movimientoActual: 'SIN_MOVIMIENTO',
        movimientoFecha: null,
      },
    });
    await this.anotar(transaccion, 'VINCULO_RESTAURAR', 'vinculo', siguiente.id, trabajador.id, sesion, cliente, {
      reabierto: reabrir,
      vinculoEliminado: vinculoId,
    });
    await this.vencimientos.vencer(transaccion, trabajador.id, actor(sesion, cliente));
    return true;
  }

  private async registrarVinculo(
    transaccion: Prisma.TransactionClient,
    documento: DocumentoCompleto,
    vinculoElegido: string | null,
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<void> {
    const trabajador = await this.trabajador(transaccion, documento.trabajadorId);
    if (trabajador.vinculos.length === 0) {
      return;
    }
    if (vinculoElegido !== null) {
      const vinculo = trabajador.vinculos.find((item) => item.id === vinculoElegido);
      if (vinculo === undefined) {
        throw new BadRequestException('El vínculo elegido no pertenece a este trabajador');
      }
      await this.enlazar(transaccion, documento, vinculo, sesion, cliente, { origen: 'historial' });
      return;
    }
    const actual = this.vinculoActual(trabajador);
    const relacionado = await this.vinculoDelContrato(transaccion, documento, trabajador);
    if (relacionado !== null) {
      await this.enlazar(transaccion, documento, relacionado, sesion, cliente, { origen: 'adenda' });
      return;
    }
    const lectura = this.datosVinculo(documento, trabajador, actual);
    if (lectura.inicio === null) {
      if (trabajador.estado === 'CESADO') {
        throw new BadRequestException('El trabajador está cesado: indica el inicio del vínculo para registrar su reingreso.');
      }
      await this.enlazar(transaccion, documento, actual, sesion, cliente, { origen: 'renovacion' });
      return;
    }
    const datos: DatosVinculo = { ...lectura, inicio: lectura.inicio };
    if (datos.tipoIncorporacion === INCORPORACION.REINGRESO) {
      this.exigirReingresoPosible(trabajador, datos.inicio);
      if (datos.inicio <= hoyEnLima()) {
        await this.aplicarReingreso(transaccion, documento, trabajador, datos, sesion, cliente);
      }
      return;
    }
    if (trabajador.estado === 'CESADO') {
      throw new BadRequestException('El trabajador está cesado: el contrato debe empezar después de su último cese.');
    }
    if (datos.tipoIncorporacion === INCORPORACION.RENOVACION) {
      if (datos.inicio > aTexto(actual.fechaInicio) && datos.inicio <= hoyEnLima()) {
        await this.abrirPeriodo(transaccion, documento, trabajador, actual, datos, sesion, cliente);
        return;
      }
      await this.enlazar(transaccion, documento, actual, sesion, cliente, { origen: 'renovacion' });
      return;
    }
    await this.vincularIngreso(transaccion, documento, trabajador, actual, datos, sesion, cliente);
  }

  private async vinculoDelContrato(
    transaccion: Prisma.TransactionClient,
    documento: DocumentoCompleto,
    trabajador: TrabajadorConVinculos,
  ): Promise<Vinculo | null> {
    const contratoId = texto(leerDatosGuardados(documento.datos)['contratoRelacionado']);
    if (contratoId === null) {
      return null;
    }
    const contrato = await transaccion.documento.findFirst({
      where: {
        id: contratoId,
        trabajadorId: trabajador.id,
        estado: { not: 'ANULADO' },
        tipoDocumento: { accion: 'VINCULO' },
      },
      select: { vinculoId: true },
    });
    if (contrato === null) {
      throw new BadRequestException('El contrato relacionado no pertenece a este trabajador o fue anulado');
    }
    const vinculo = trabajador.vinculos.find((item) => item.id === contrato.vinculoId);
    return vinculo ?? this.vinculoActual(trabajador);
  }

  private async abrirPeriodo(
    transaccion: Prisma.TransactionClient,
    documento: DocumentoCompleto,
    trabajador: TrabajadorConVinculos,
    anterior: Vinculo,
    datos: DatosVinculo,
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<void> {
    const nuevo = {
      regimenId: datos.regimenId,
      cargoId: datos.cargoId ?? anterior.cargoId,
      areaId: datos.areaId ?? anterior.areaId,
    };
    await exigirCatalogosActivos(this.prisma, nuevo);
    const motivo: MotivoCambio =
      nuevo.regimenId !== anterior.regimenId
        ? 'CAMBIO_REGIMEN'
        : nuevo.areaId !== anterior.areaId || nuevo.cargoId !== anterior.cargoId
          ? 'CAMBIO_CARGO_O_AREA'
          : 'RENOVACION';
    const fin = diaAnterior(datos.inicio);
    await transaccion.vinculo.update({ where: { id: anterior.id }, data: { fechaFin: aFecha(fin), motivoFin: motivo, actual: false } });
    const vinculo = await transaccion.vinculo.create({
      data: {
        trabajadorId: trabajador.id,
        ...nuevo,
        tipoPersonal: anterior.tipoPersonal,
        fechaInicio: aFecha(datos.inicio),
        referencia: referencia(documento),
      },
    });
    await transaccion.documento.update({ where: { id: documento.id }, data: { vinculoId: vinculo.id } });
    await this.anotar(transaccion, 'VINCULO_FINALIZAR', 'vinculo', anterior.id, trabajador.id, sesion, cliente, {
      motivo,
      fechaFin: fin,
      documento: documento.id,
    });
    await this.anotar(transaccion, 'VINCULO_CREAR', 'vinculo', vinculo.id, trabajador.id, sesion, cliente, {
      origen: 'renovacion',
      fechaInicio: datos.inicio,
      documento: documento.id,
    });
  }

  async vincular(id: string, sesion: SesionActiva, cliente: DatosCliente): Promise<DocumentDto> {
    const documento = await this.cargar(id, sesion);
    if (documento.tipoDocumento.accion !== 'VINCULO') {
      throw new BadRequestException('Solo los contratos y resoluciones se vinculan al historial');
    }
    if (documento.vinculoId !== null) {
      throw new ConflictException('Este documento ya figura en el historial');
    }
    await this.prisma.$transaction(async (transaccion) => {
      const trabajador = await this.trabajador(transaccion, documento.trabajadorId);
      if (trabajador.estado === 'CESADO') {
        throw new BadRequestException('El trabajador está cesado: confirma el reingreso desde el detalle del documento');
      }
      await this.registrarVinculo(transaccion, documento, null, sesion, cliente);
      await this.extenderPeriodo(transaccion, documento.id, sesion, cliente);
      await this.vencimientos.vencer(transaccion, trabajador.id, actor(sesion, cliente));
    });
    return aDocumentoDto(await this.cargar(id, sesion), sesion);
  }

  async enlazarPeriodo(id: string, vinculoId: string, sesion: SesionActiva, cliente: DatosCliente): Promise<DocumentDto> {
    const documento = await this.cargar(id, sesion);
    if (documento.tipoDocumento.accion !== 'VINCULO') {
      throw new BadRequestException('Solo un contrato, adenda o resolución sustenta un período del historial');
    }
    if (documento.estado === 'ANULADO') {
      throw new BadRequestException('El documento está anulado');
    }
    if (documento.vinculoId !== null) {
      throw new ConflictException('Este documento ya está enlazado a un período del historial');
    }
    await this.prisma.$transaction(async (transaccion) => {
      const trabajador = await this.trabajador(transaccion, documento.trabajadorId);
      const vinculo = trabajador.vinculos.find((item) => item.id === vinculoId);
      if (vinculo === undefined) {
        throw new BadRequestException('El período elegido no pertenece a este trabajador');
      }
      await this.enlazar(transaccion, documento, vinculo, sesion, cliente, { origen: 'historial' });
      const inicio = texto(leerDatosGuardados(documento.datos)['inicio']);
      const reingresoPendiente = documento.confirmadoEn === null && inicio !== null && inicio === aTexto(vinculo.fechaInicio);
      if (reingresoPendiente && vinculo.actual && trabajador.estado === 'ACTIVO') {
        await this.marcarConfirmado(transaccion, documento, sesion, cliente);
      }
      await this.extenderPeriodo(transaccion, documento.id, sesion, cliente);
      await this.vencimientos.vencer(transaccion, trabajador.id, actor(sesion, cliente));
    });
    return aDocumentoDto(await this.cargar(id, sesion), sesion);
  }

  async confirmarReingreso(id: string, sesion: SesionActiva, cliente: DatosCliente): Promise<DocumentDto> {
    const documento = await this.cargar(id, sesion);
    this.exigirDisponible(documento, 'VINCULO');
    await this.prisma.$transaction(async (transaccion) => {
      const trabajador = await this.trabajador(transaccion, documento.trabajadorId);
      if (trabajador.vinculos.length === 0) {
        throw new BadRequestException(
          'El trabajador no tiene períodos en su historial: registra el reingreso desde la ficha y luego enlaza este contrato.',
        );
      }
      const lectura = this.datosVinculo(documento, trabajador, this.vinculoActual(trabajador));
      if (lectura.inicio === null) {
        throw new BadRequestException('Completa el inicio del vínculo en el documento para confirmar el reingreso');
      }
      const datos: DatosVinculo = { ...lectura, inicio: lectura.inicio };
      if (datos.inicio > hoyEnLima()) {
        throw new BadRequestException('El reingreso todavía no es efectivo. Confírmalo desde su fecha de inicio.');
      }
      const actual = trabajador.estado === 'ACTIVO' ? this.vinculoActual(trabajador) : null;
      if (actual !== null && aTexto(actual.fechaInicio) === datos.inicio) {
        await this.enlazar(transaccion, documento, actual, sesion, cliente, { origen: 'reingreso' });
        await this.marcarConfirmado(transaccion, documento, sesion, cliente);
      } else {
        this.exigirReingresoPosible(trabajador, datos.inicio);
        await this.aplicarReingreso(transaccion, documento, trabajador, datos, sesion, cliente);
      }
      await this.vencimientos.vencer(transaccion, trabajador.id, actor(sesion, cliente));
    });
    return aDocumentoDto(await this.cargar(id, sesion), sesion);
  }

  private async aplicarReingreso(
    transaccion: Prisma.TransactionClient,
    documento: DocumentoCompleto,
    trabajador: TrabajadorConVinculos,
    datos: DatosVinculo,
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<void> {
    const anterior = this.vinculoActual(trabajador);
    const nuevo = {
      regimenId: datos.regimenId,
      cargoId: datos.cargoId ?? anterior.cargoId,
      areaId: datos.areaId ?? anterior.areaId,
    };
    await exigirCatalogosActivos(this.prisma, nuevo);
    const continuidad =
      anterior.motivoFin === 'FIN_CONTRATO' && anterior.fechaFin !== null && datos.inicio === diaSiguiente(aTexto(anterior.fechaFin));
    await transaccion.vinculo.update({
      where: { id: anterior.id },
      data: continuidad ? { actual: false, motivoFin: 'RENOVACION' } : { actual: false },
    });
    const vinculo = await transaccion.vinculo.create({
      data: {
        trabajadorId: trabajador.id,
        ...nuevo,
        tipoPersonal: anterior.tipoPersonal,
        fechaInicio: aFecha(datos.inicio),
        referencia: referencia(documento),
      },
    });
    await transaccion.trabajador.update({
      where: { id: trabajador.id },
      data: { estado: 'ACTIVO', movimientoActual: 'SIN_MOVIMIENTO', movimientoFecha: null, fechaIngreso: aFecha(datos.inicio) },
    });
    await transaccion.documento.update({ where: { id: documento.id }, data: { vinculoId: vinculo.id } });
    await this.anotar(transaccion, 'VINCULO_CREAR', 'vinculo', vinculo.id, trabajador.id, sesion, cliente, {
      origen: continuidad ? 'continuidad' : 'reingreso',
      fechaIngreso: datos.inicio,
      documento: documento.id,
    });
    await this.marcarConfirmado(transaccion, documento, sesion, cliente);
  }

  private async marcarConfirmado(
    transaccion: Prisma.TransactionClient,
    documento: DocumentoCompleto,
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<void> {
    await transaccion.documento.update({
      where: { id: documento.id },
      data: { confirmadoPorId: sesion.usuarioId, confirmadoEn: new Date() },
    });
    await this.anotar(transaccion, 'DOCUMENTO_CONFIRMAR', 'documento', documento.id, documento.trabajadorId, sesion, cliente, {
      efecto: 'reingreso',
    });
  }

  async confirmarMovimiento(id: string, datos: MovementInputDto, sesion: SesionActiva, cliente: DatosCliente): Promise<DocumentDto> {
    const documento = await this.cargar(id, sesion);
    this.exigirDisponible(documento, 'MOVIMIENTO');
    if (documento.movimiento !== null) {
      throw new ConflictException('Este movimiento ya fue confirmado');
    }
    await this.prisma.$transaction(async (transaccion) => {
      const trabajador = await this.trabajador(transaccion, documento.trabajadorId);
      await this.aplicarMovimiento(transaccion, trabajador, { ...datos, documentoId: documento.id }, sesion, cliente);
      const anteriores = leerDatosGuardados(documento.datos);
      await transaccion.documento.update({
        where: { id: documento.id },
        data: {
          datos: {
            ...anteriores,
            tipoMovimiento: TEXTO_MOVIMIENTO[datos.tipo],
            areaOrigen: datos.areaOrigenId,
            areaDestino: datos.areaDestinoId,
            fechaEfecto: datos.fecha,
          },
          confirmadoPorId: sesion.usuarioId,
          confirmadoEn: new Date(),
        },
      });
      await this.anotar(transaccion, 'DOCUMENTO_CONFIRMAR', 'documento', documento.id, trabajador.id, sesion, cliente, {
        efecto: 'movimiento',
        tipo: datos.tipo,
      });
    });
    return aDocumentoDto(await this.cargar(id, sesion), sesion);
  }

  async confirmarCese(id: string, datos: CeseInputDto, sesion: SesionActiva, cliente: DatosCliente): Promise<DocumentDto> {
    const documento = await this.cargar(id, sesion);
    this.exigirDisponible(documento, 'CESE');
    if (datos.fecha > hoyEnLima()) {
      throw new BadRequestException('El cese aún no es efectivo. Confírmalo a partir de la fecha indicada.');
    }
    await this.prisma.$transaction(async (transaccion) => {
      const trabajador = await this.trabajador(transaccion, documento.trabajadorId);
      if (trabajador.estado === 'CESADO') {
        throw new ConflictException('El trabajador ya está cesado');
      }
      const vinculo = this.vinculoActual(trabajador);
      if (datos.fecha < aTexto(vinculo.fechaInicio)) {
        throw new BadRequestException('La fecha de cese no puede ser anterior al ingreso actual');
      }
      await transaccion.vinculo.update({
        where: { id: vinculo.id },
        data: { fechaFin: aFecha(datos.fecha), motivoFin: datos.motivo },
      });
      await transaccion.trabajador.update({
        where: { id: trabajador.id },
        data: { estado: 'CESADO', movimientoActual: 'SIN_MOVIMIENTO', movimientoFecha: null },
      });
      await transaccion.documento.update({
        where: { id: documento.id },
        data: {
          datos: { ...leerDatosGuardados(documento.datos), motivoCese: TEXTO_MOTIVO_CESE[datos.motivo], fechaCese: datos.fecha },
          vinculoId: vinculo.id,
          confirmadoPorId: sesion.usuarioId,
          confirmadoEn: new Date(),
        },
      });
      await this.anotar(transaccion, 'VINCULO_FINALIZAR', 'vinculo', vinculo.id, trabajador.id, sesion, cliente, {
        motivo: datos.motivo,
        fechaCese: datos.fecha,
        documento: documento.id,
        observacion: datos.observacion,
      });
      await this.anotar(transaccion, 'DOCUMENTO_CONFIRMAR', 'documento', documento.id, trabajador.id, sesion, cliente, {
        efecto: 'cese',
      });
    });
    return aDocumentoDto(await this.cargar(id, sesion), sesion);
  }

  async aplicarMovimiento(
    transaccion: Prisma.TransactionClient,
    trabajador: TrabajadorConVinculos,
    datos: NuevoMovimiento,
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<void> {
    if (trabajador.estado !== 'ACTIVO') {
      throw new BadRequestException('El trabajador está cesado: primero registra y confirma su reingreso');
    }
    const vinculo = this.vinculoActual(trabajador);
    if (datos.fecha > hoyEnLima()) {
      throw new BadRequestException('La fecha efectiva es futura. Confirma el movimiento cuando tenga efecto.');
    }
    if (datos.fecha < aTexto(vinculo.fechaInicio)) {
      throw new BadRequestException('La fecha del movimiento no puede ser anterior al ingreso actual');
    }
    const areas = await transaccion.area.findMany({
      where: { id: { in: [datos.areaOrigenId, datos.areaDestinoId] }, activo: true },
      select: { id: true },
    });
    if (!areas.some((area) => area.id === datos.areaOrigenId) || !areas.some((area) => area.id === datos.areaDestinoId)) {
      throw new BadRequestException('El área de origen o destino no existe o está inactiva');
    }
    const movimiento = await transaccion.movimientoLaboral.create({
      data: {
        trabajadorId: trabajador.id,
        tipo: datos.tipo,
        fecha: aFecha(datos.fecha),
        areaOrigenId: datos.areaOrigenId,
        areaDestinoId: datos.areaDestinoId,
        documentoId: datos.documentoId,
        observacion: datos.observacion,
        creadoPorId: sesion.usuarioId,
      },
    });
    const masReciente = trabajador.movimientoFecha === null || datos.fecha >= aTexto(trabajador.movimientoFecha);
    if (masReciente) {
      await transaccion.trabajador.update({
        where: { id: trabajador.id },
        data: { movimientoActual: datos.tipo, movimientoFecha: aFecha(datos.fecha) },
      });
      await transaccion.vinculo.update({ where: { id: vinculo.id }, data: { areaId: datos.areaDestinoId } });
    }
    await this.anotar(transaccion, 'MOVIMIENTO_REGISTRAR', 'movimiento', movimiento.id, trabajador.id, sesion, cliente, {
      tipo: datos.tipo,
      fecha: datos.fecha,
      areaOrigen: datos.areaOrigenId,
      areaDestino: datos.areaDestinoId,
      documento: datos.documentoId,
      actualizaFicha: masReciente,
      observacion: datos.observacion,
    });
  }

  async trabajador(transaccion: Prisma.TransactionClient, id: string): Promise<TrabajadorConVinculos> {
    const trabajador = await transaccion.trabajador.findUnique({ where: { id }, include: incluirTrabajador });
    if (trabajador === null) {
      throw new NotFoundException('El trabajador no existe');
    }
    return trabajador;
  }

  private async vincularIngreso(
    transaccion: Prisma.TransactionClient,
    documento: DocumentoCompleto,
    trabajador: TrabajadorConVinculos,
    actual: Vinculo,
    datos: DatosVinculo,
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<void> {
    const mismoInicio = await transaccion.documento.count({
      where: {
        id: { not: documento.id },
        vinculoId: actual.id,
        estado: { not: 'ANULADO' },
        tipoDocumento: { accion: 'VINCULO' },
        datos: { path: ['inicio'], equals: datos.inicio },
      },
    });
    if (mismoInicio > 0) {
      throw new ConflictException('Ya existe una incorporación vinculada con la misma fecha de inicio. Revisa el historial.');
    }
    const otrosSustentos = await transaccion.documento.count({
      where: { id: { not: documento.id }, vinculoId: actual.id, estado: { not: 'ANULADO' }, tipoDocumento: { accion: 'VINCULO' } },
    });
    const cambios: Prisma.VinculoUncheckedUpdateInput = { regimenId: datos.regimenId };
    if (datos.areaId !== null) {
      cambios.areaId = datos.areaId;
    }
    if (datos.cargoId !== null) {
      cambios.cargoId = datos.cargoId;
    }
    if (otrosSustentos === 0 && datos.inicio !== aTexto(actual.fechaInicio)) {
      const anterior = trabajador.vinculos.find((vinculo) => vinculo.id !== actual.id);
      if (anterior?.fechaFin != null && datos.inicio <= aTexto(anterior.fechaFin)) {
        throw new BadRequestException('El inicio del contrato se cruza con un vínculo anterior del historial');
      }
      cambios.fechaInicio = aFecha(datos.inicio);
      await transaccion.trabajador.update({ where: { id: trabajador.id }, data: { fechaIngreso: aFecha(datos.inicio) } });
    }
    await transaccion.vinculo.update({ where: { id: actual.id }, data: cambios });
    await this.enlazar(transaccion, documento, actual, sesion, cliente, {
      origen: 'primer_ingreso',
      inicio: datos.inicio,
      regimen: datos.regimenId,
      area: datos.areaId,
      cargo: datos.cargoId,
    });
  }

  private async enlazar(
    transaccion: Prisma.TransactionClient,
    documento: DocumentoCompleto,
    vinculo: Vinculo,
    sesion: SesionActiva,
    cliente: DatosCliente,
    detalle: Record<string, string | number | null>,
  ): Promise<void> {
    await transaccion.documento.update({ where: { id: documento.id }, data: { vinculoId: vinculo.id } });
    const sinReferencia = vinculo.referencia === null || vinculo.referencia.trim() === '';
    if (sinReferencia) {
      await transaccion.vinculo.update({ where: { id: vinculo.id }, data: { referencia: referencia(documento) } });
    }
    await this.anotar(transaccion, 'DOCUMENTO_VINCULAR', 'documento', documento.id, documento.trabajadorId, sesion, cliente, {
      vinculo: vinculo.id,
      ...(sinReferencia ? { referencia: referencia(documento) } : {}),
      ...detalle,
    });
  }

  private datosVinculo(documento: DocumentoCompleto, trabajador: TrabajadorConVinculos, actual: Vinculo): LecturaVinculo {
    const datos = leerDatosGuardados(documento.datos);
    const inicio = texto(datos['inicio']);
    const fin = texto(datos['fin']);
    if (inicio !== null && fin !== null && fin < inicio) {
      throw new BadRequestException('La fecha de término no puede ser anterior a la fecha de inicio');
    }
    const declarado = texto(datos['tipoIncorporacion']);
    const tipoIncorporacion =
      declarado ??
      (trabajador.estado === 'CESADO'
        ? INCORPORACION.REINGRESO
        : inicio !== null && inicio > aTexto(actual.fechaInicio)
          ? INCORPORACION.RENOVACION
          : INCORPORACION.PRIMER_INGRESO);
    return {
      tipoIncorporacion,
      regimenId: numero(datos['regimen']) ?? actual.regimenId,
      inicio,
      fin,
      areaId: numero(datos['dependencia']),
      cargoId: numero(datos['puesto']),
    };
  }

  private exigirReingresoPosible(trabajador: TrabajadorConVinculos, inicio: string): Vinculo {
    if (trabajador.estado !== 'CESADO') {
      throw new BadRequestException(
        'Para registrar un reingreso el trabajador debe estar cesado. Si continúa activo, elige Renovación o continuidad: el contrato abre un nuevo período con su régimen, área y cargo sin cesar al trabajador.',
      );
    }
    const ultimo = this.vinculoActual(trabajador);
    if (ultimo.motivoFin === 'FALLECIMIENTO') {
      throw new BadRequestException('No se registra reingreso: el cese fue por fallecimiento');
    }
    if (ultimo.fechaFin !== null && inicio <= aTexto(ultimo.fechaFin)) {
      throw new BadRequestException('La fecha del reingreso debe ser posterior a la fecha del último cese');
    }
    return ultimo;
  }

  private exigirDisponible(documento: DocumentoCompleto, accion: 'VINCULO' | 'MOVIMIENTO' | 'CESE'): void {
    if (documento.tipoDocumento.accion !== accion) {
      throw new BadRequestException('Este tipo de documento no permite esta confirmación');
    }
    if (documento.estado !== 'DISPONIBLE') {
      throw new BadRequestException('Para confirmar se necesita el PDF registrado y procesado');
    }
    if (documento.confirmadoEn !== null) {
      throw new ConflictException('Este documento ya fue confirmado');
    }
  }

  private vinculoActual(trabajador: TrabajadorConVinculos): Vinculo {
    const vinculo = trabajador.vinculos.find((item) => item.actual);
    if (vinculo === undefined) {
      throw new BadRequestException('El trabajador no tiene un vínculo registrado');
    }
    return vinculo;
  }

  private async cargar(id: string, sesion: SesionActiva): Promise<DocumentoCompleto> {
    if (!sesion.permisos.includes('personal.editar')) {
      throw new ForbiddenException('No tienes permiso para actualizar la situación laboral');
    }
    const documento = await this.prisma.documento.findFirst({
      where: { id, ...filtroVisibilidad(sesion) },
      include: incluirDocumento,
    });
    if (documento === null) {
      throw new NotFoundException('El documento no existe');
    }
    return documento;
  }

  private async anotar(
    transaccion: Prisma.TransactionClient,
    accion: string,
    entidad: string,
    entidadId: string,
    trabajadorId: string,
    sesion: SesionActiva,
    cliente: DatosCliente,
    detalle: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    await this.auditoria.registrar(
      { accion, entidad, entidadId, trabajadorId, usuarioId: sesion.usuarioId, cliente, detalle },
      transaccion,
    );
  }
}
