import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aFecha, aTexto, diaAnterior, hoyEnLima } from '../common/dates';
import type { LinkChangeDto, ReentryDto, SituationDto } from './dto/worker-input.dto';
import type { WorkerDetailDto } from './dto/worker.dto';
import { exigirCatalogosActivos } from './catalog-guard';
import { LaborService } from '../labor/labor.service';
import { aDetalleDto, incluirDetalle, type TrabajadorDetalle } from './worker.mapper';

@Injectable()
export class WorkerLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
    private readonly laboral: LaborService,
  ) {}

  async actualizarSituacion(
    id: string,
    datos: SituationDto,
    actor: SesionActiva,
    cliente: DatosCliente,
  ): Promise<WorkerDetailDto> {
    const trabajador = await this.cargar(id);
    const hoy = hoyEnLima();

    if (datos.estado === 'ACTIVO' && trabajador.estado === 'CESADO') {
      throw new BadRequestException('Para que vuelva a laborar usa Reingreso: se registra un nuevo período en el mismo legajo');
    }

    if (datos.estado === 'CESADO') {
      if (trabajador.estado === 'CESADO') {
        throw new BadRequestException('El trabajador ya está cesado');
      }
      throw new BadRequestException(
        'Para confirmar un cese, registra el PDF en la Sección 11 y pulsa «Confirmar cese laboral» desde Ver detalle',
      );
    }

    if (datos.movimiento !== 'SIN_MOVIMIENTO') {
      const tipo = datos.movimiento;
      if (datos.movimientoFecha === null || datos.areaOrigenId === null || datos.areaDestinoId === null) {
        throw new BadRequestException('Indica la fecha, el área de origen y el área de destino del movimiento');
      }
      const movimiento = {
        tipo,
        fecha: datos.movimientoFecha,
        areaOrigenId: datos.areaOrigenId,
        areaDestinoId: datos.areaDestinoId,
        observacion: datos.observacion,
        documentoId: null,
      };
      await this.prisma.$transaction(async (transaccion) => {
        const actual = await this.laboral.trabajador(transaccion, id);
        await this.laboral.aplicarMovimiento(transaccion, actual, movimiento, actor, cliente);
      });
      return this.obtener(id);
    }

    if (datos.movimientoFecha !== null && datos.movimientoFecha > hoy) {
      throw new BadRequestException('La fecha no puede ser futura');
    }
    await this.prisma.$transaction(async (transaccion) => {
      await transaccion.trabajador.update({
        where: { id },
        data: { movimientoActual: 'SIN_MOVIMIENTO', movimientoFecha: null },
      });
      await this.auditoria.registrar(
        {
          accion: 'TRABAJADOR_MOVIMIENTO',
          entidad: 'trabajador',
          entidadId: id,
          trabajadorId: id,
          usuarioId: actor.usuarioId,
          cliente,
          detalle: {
            antes: trabajador.movimientoActual,
            despues: datos.movimiento,
            fecha: datos.movimientoFecha,
            observacion: datos.observacion,
          },
        },
        transaccion,
      );
    });
    return this.obtener(id);
  }

  async reingresar(id: string, datos: ReentryDto, actor: SesionActiva, cliente: DatosCliente): Promise<WorkerDetailDto> {
    const trabajador = await this.cargar(id);
    if (trabajador.estado !== 'CESADO') {
      throw new BadRequestException('Solo se registra reingreso de un trabajador cesado');
    }
    const ultimo = trabajador.vinculos.find((item) => item.actual) ?? null;
    if (ultimo?.motivoFin === 'FALLECIMIENTO') {
      throw new BadRequestException('No se puede registrar reingreso: el cese fue por fallecimiento');
    }
    if (ultimo?.fechaFin != null && datos.fechaIngreso <= aTexto(ultimo.fechaFin)) {
      throw new BadRequestException('La fecha de reingreso debe ser posterior al último cese');
    }
    if (datos.fechaIngreso > hoyEnLima()) {
      throw new BadRequestException('La fecha de reingreso no puede ser futura');
    }
    await exigirCatalogosActivos(this.prisma, datos);

    await this.prisma.$transaction(async (transaccion) => {
      if (ultimo !== null) {
        await transaccion.vinculo.update({ where: { id: ultimo.id }, data: { actual: false } });
      }
      const nuevo = await transaccion.vinculo.create({
        data: {
          trabajadorId: id,
          regimenId: datos.regimenId,
          tipoPersonal: datos.tipoPersonal,
          cargoId: datos.cargoId,
          areaId: datos.areaId,
          fechaInicio: aFecha(datos.fechaIngreso),
          referencia: datos.referencia ?? null,
        },
      });
      await transaccion.trabajador.update({
        where: { id },
        data: { estado: 'ACTIVO', movimientoActual: 'SIN_MOVIMIENTO', movimientoFecha: null, fechaIngreso: aFecha(datos.fechaIngreso) },
      });
      await this.auditoria.registrar(
        {
          accion: 'VINCULO_CREAR',
          entidad: 'vinculo',
          entidadId: nuevo.id,
          trabajadorId: id,
          usuarioId: actor.usuarioId,
          cliente,
          detalle: { origen: 'reingreso', fechaIngreso: datos.fechaIngreso },
        },
        transaccion,
      );
    });
    return this.obtener(id);
  }

  async cambiarVinculo(id: string, datos: LinkChangeDto, actor: SesionActiva, cliente: DatosCliente): Promise<WorkerDetailDto> {
    const trabajador = await this.cargar(id);
    if (trabajador.estado !== 'ACTIVO') {
      throw new BadRequestException('El trabajador está cesado. Usa Reingreso.');
    }
    const actual = this.vinculoActual(trabajador);
    if (datos.fechaInicio <= aTexto(actual.fechaInicio)) {
      throw new BadRequestException('El nuevo vínculo debe empezar después del inicio del vínculo actual');
    }
    if (datos.fechaInicio > hoyEnLima()) {
      throw new BadRequestException('La fecha de inicio no puede ser futura');
    }
    await exigirCatalogosActivos(this.prisma, datos);

    await this.prisma.$transaction(async (transaccion) => {
      await transaccion.vinculo.update({
        where: { id: actual.id },
        data: { fechaFin: aFecha(diaAnterior(datos.fechaInicio)), motivoFin: datos.motivo, actual: false },
      });
      const nuevo = await transaccion.vinculo.create({
        data: {
          trabajadorId: id,
          regimenId: datos.regimenId,
          tipoPersonal: datos.tipoPersonal,
          cargoId: datos.cargoId,
          areaId: datos.areaId,
          fechaInicio: aFecha(datos.fechaInicio),
          referencia: datos.referencia ?? null,
        },
      });
      await this.auditoria.registrar(
        {
          accion: 'VINCULO_FINALIZAR',
          entidad: 'vinculo',
          entidadId: actual.id,
          trabajadorId: id,
          usuarioId: actor.usuarioId,
          cliente,
          detalle: { motivo: datos.motivo, fechaFin: diaAnterior(datos.fechaInicio) },
        },
        transaccion,
      );
      await this.auditoria.registrar(
        {
          accion: 'VINCULO_CREAR',
          entidad: 'vinculo',
          entidadId: nuevo.id,
          trabajadorId: id,
          usuarioId: actor.usuarioId,
          cliente,
          detalle: { origen: datos.motivo, fechaInicio: datos.fechaInicio },
        },
        transaccion,
      );
    });
    return this.obtener(id);
  }

  private async obtener(id: string): Promise<WorkerDetailDto> {
    return aDetalleDto(await this.cargar(id));
  }

  private async cargar(id: string): Promise<TrabajadorDetalle> {
    const trabajador = await this.prisma.trabajador.findUnique({ where: { id }, include: incluirDetalle });
    if (trabajador === null) {
      throw new NotFoundException('El trabajador no existe');
    }
    return trabajador;
  }

  private vinculoActual(trabajador: TrabajadorDetalle): TrabajadorDetalle['vinculos'][number] {
    const vinculo = trabajador.vinculos.find((item) => item.actual);
    if (vinculo === undefined) {
      throw new BadRequestException('El trabajador no tiene un vínculo registrado');
    }
    return vinculo;
  }
}
