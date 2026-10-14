import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import type { RoleSectionAccessDto, SectionAccessDto } from './dto/section-access.dto';

const ROL_ADMINISTRADOR = 'Administrador';

@Injectable()
export class SectionAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
    private readonly sesiones: SessionService,
  ) {}

  async listar(): Promise<SectionAccessDto> {
    const [secciones, roles] = await Promise.all([
      this.prisma.seccion.findMany({ where: { numero: { gt: 1 } }, select: { numero: true, nombre: true }, orderBy: { numero: 'asc' } }),
      this.prisma.rol.findMany({
        select: { id: true, nombre: true, restricciones: { select: { seccion: { select: { numero: true } } } } },
        orderBy: { nombre: 'asc' },
      }),
    ]);
    return { secciones, roles: roles.map((rol) => this.aRolDto(rol)) };
  }

  async actualizar(rolId: string, restringidas: number[], actor: SesionActiva, cliente: DatosCliente): Promise<RoleSectionAccessDto> {
    const rol = await this.prisma.rol.findUnique({
      where: { id: rolId },
      select: { id: true, nombre: true, restricciones: { select: { seccion: { select: { numero: true } } } } },
    });
    if (rol === null) {
      throw new NotFoundException('El rol no existe');
    }
    if (rol.nombre === ROL_ADMINISTRADOR) {
      throw new BadRequestException('El administrador conserva acceso a todas las secciones');
    }
    const numeros = [...new Set(restringidas)].sort((a, b) => a - b);
    const secciones = await this.prisma.seccion.findMany({ where: { numero: { in: numeros } }, select: { id: true } });
    const antes = rol.restricciones.map((item) => item.seccion.numero).sort((a, b) => a - b);
    await this.prisma.$transaction(async (transaccion) => {
      await transaccion.rolSeccionRestringida.deleteMany({ where: { rolId } });
      if (secciones.length > 0) {
        await transaccion.rolSeccionRestringida.createMany({ data: secciones.map((seccion) => ({ rolId, seccionId: seccion.id })) });
      }
      await this.auditoria.registrar(
        {
          accion: 'ROL_EDITAR',
          entidad: 'rol',
          entidadId: rolId,
          usuarioId: actor.usuarioId,
          cliente,
          detalle: { seccionesRestringidas: { antes: antes.join(','), despues: numeros.join(',') } },
        },
        transaccion,
      );
    });
    await this.sesiones.olvidarRestricciones();
    return { id: rol.id, nombre: rol.nombre, bloqueado: false, restringidas: numeros };
  }

  private aRolDto(rol: { id: string; nombre: string; restricciones: Array<{ seccion: { numero: number } }> }): RoleSectionAccessDto {
    return {
      id: rol.id,
      nombre: rol.nombre,
      bloqueado: rol.nombre === ROL_ADMINISTRADOR,
      restringidas: rol.restricciones.map((item) => item.seccion.numero).sort((a, b) => a - b),
    };
  }
}
