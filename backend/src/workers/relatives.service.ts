import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aFecha, hoyEnLima } from '../common/dates';
import type { RelativeInputDto } from './dto/worker-input.dto';
import type { RelativeDto } from './dto/worker.dto';
import { aFamiliarDto } from './worker.mapper';

@Injectable()
export class RelativesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
  ) {}

  async crear(trabajadorId: string, datos: RelativeInputDto, actor: SesionActiva, cliente: DatosCliente): Promise<RelativeDto> {
    await this.exigirTrabajador(trabajadorId);
    this.validarFecha(datos);
    const creado = await this.prisma.$transaction(async (transaccion) => {
      const familiar = await transaccion.familiar.create({ data: { ...this.datos(datos), trabajadorId } });
      await this.auditoria.registrar(
        {
          accion: 'FAMILIAR_CREAR',
          entidad: 'familiar',
          entidadId: familiar.id,
          trabajadorId,
          usuarioId: actor.usuarioId,
          cliente,
          detalle: { parentesco: familiar.parentesco },
        },
        transaccion,
      );
      return familiar;
    });
    return aFamiliarDto(creado);
  }

  async editar(
    trabajadorId: string,
    id: string,
    datos: RelativeInputDto,
    actor: SesionActiva,
    cliente: DatosCliente,
  ): Promise<RelativeDto> {
    await this.exigirFamiliar(trabajadorId, id);
    this.validarFecha(datos);
    const actualizado = await this.prisma.$transaction(async (transaccion) => {
      const familiar = await transaccion.familiar.update({ where: { id }, data: this.datos(datos) });
      await this.auditoria.registrar(
        { accion: 'FAMILIAR_EDITAR', entidad: 'familiar', entidadId: id, trabajadorId, usuarioId: actor.usuarioId, cliente },
        transaccion,
      );
      return familiar;
    });
    return aFamiliarDto(actualizado);
  }

  async quitar(trabajadorId: string, id: string, actor: SesionActiva, cliente: DatosCliente): Promise<void> {
    const familiar = await this.exigirFamiliar(trabajadorId, id);
    await this.prisma.$transaction(async (transaccion) => {
      await transaccion.familiar.delete({ where: { id } });
      await this.auditoria.registrar(
        {
          accion: 'FAMILIAR_QUITAR',
          entidad: 'familiar',
          entidadId: id,
          trabajadorId,
          usuarioId: actor.usuarioId,
          cliente,
          detalle: { parentesco: familiar.parentesco, nombresApellidos: familiar.nombresApellidos },
        },
        transaccion,
      );
    });
  }

  private datos(datos: RelativeInputDto) {
    return {
      parentesco: datos.parentesco,
      nombresApellidos: datos.nombresApellidos,
      numeroDoc: datos.numeroDoc === null ? null : datos.numeroDoc.toUpperCase(),
      fechaNacimiento: datos.fechaNacimiento === null ? null : aFecha(datos.fechaNacimiento),
    };
  }

  private validarFecha(datos: RelativeInputDto): void {
    if (datos.fechaNacimiento !== null && datos.fechaNacimiento > hoyEnLima()) {
      throw new BadRequestException('La fecha de nacimiento no puede ser futura');
    }
  }

  private async exigirTrabajador(id: string): Promise<void> {
    if ((await this.prisma.trabajador.count({ where: { id } })) === 0) {
      throw new NotFoundException('El trabajador no existe');
    }
  }

  private async exigirFamiliar(trabajadorId: string, id: string): Promise<{ parentesco: string; nombresApellidos: string }> {
    const familiar = await this.prisma.familiar.findFirst({
      where: { id, trabajadorId },
      select: { parentesco: true, nombresApellidos: true },
    });
    if (familiar === null) {
      throw new NotFoundException('El familiar no existe');
    }
    return familiar;
  }
}
