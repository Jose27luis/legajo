import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Regimen } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { sinDuplicados } from '../common/unique-violation';
import type { AreaDto, PositionDto, RegimeDto } from './dto/catalog.dto';
import type { AreaInputDto, CreateRegimeDto, PositionInputDto, UpdateRegimeDto } from './dto/catalog-input.dto';

export function aRegimenDto(regimen: Regimen): RegimeDto {
  return {
    id: regimen.id,
    codigo: regimen.codigo,
    nombre: regimen.nombre,
    esLaboral: regimen.esLaboral,
    activo: regimen.activo,
  };
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
  ) {}

  async listarRegimenes(): Promise<RegimeDto[]> {
    const regimenes = await this.prisma.regimen.findMany({ orderBy: { nombre: 'asc' } });
    return regimenes.map(aRegimenDto);
  }

  async crearRegimen(datos: CreateRegimeDto, actor: SesionActiva, cliente: DatosCliente): Promise<RegimeDto> {
    const creado = await sinDuplicados(
      () =>
        this.prisma.$transaction(async (transaccion) => {
          const regimen = await transaccion.regimen.create({ data: datos });
          await this.registrar('CATALOGO_CREAR', 'regimen', regimen.id, actor, cliente, { codigo: regimen.codigo }, transaccion);
          return regimen;
        }),
      'Ya existe un régimen con ese código',
    );
    return aRegimenDto(creado);
  }

  async editarRegimen(id: number, datos: UpdateRegimeDto, actor: SesionActiva, cliente: DatosCliente): Promise<RegimeDto> {
    await this.exigir(this.prisma.regimen.count({ where: { id } }), 'El régimen no existe');
    const actualizado = await this.prisma.$transaction(async (transaccion) => {
      const regimen = await transaccion.regimen.update({ where: { id }, data: datos });
      await this.registrar('CATALOGO_EDITAR', 'regimen', id, actor, cliente, { ...datos }, transaccion);
      return regimen;
    });
    return aRegimenDto(actualizado);
  }

  async listarAreas(): Promise<AreaDto[]> {
    const areas = await this.prisma.area.findMany({ include: { padre: true }, orderBy: { nombre: 'asc' } });
    return areas.map((area) => ({
      id: area.id,
      nombre: area.nombre,
      padreId: area.padreId,
      padreNombre: area.padre?.nombre ?? null,
      activo: area.activo,
    }));
  }

  async crearArea(datos: AreaInputDto, actor: SesionActiva, cliente: DatosCliente): Promise<AreaDto> {
    const padreId = datos.padreId ?? null;
    await this.validarPadre(null, padreId);
    const creada = await sinDuplicados(
      () =>
        this.prisma.$transaction(async (transaccion) => {
          const area = await transaccion.area.create({
            data: { nombre: datos.nombre, padreId, activo: datos.activo },
            include: { padre: true },
          });
          await this.registrar('CATALOGO_CREAR', 'area', area.id, actor, cliente, { nombre: area.nombre, padreId }, transaccion);
          return area;
        }),
      'Ya existe un área con ese nombre en la misma dependencia',
    );
    return { id: creada.id, nombre: creada.nombre, padreId: creada.padreId, padreNombre: creada.padre?.nombre ?? null, activo: creada.activo };
  }

  async editarArea(id: number, datos: AreaInputDto, actor: SesionActiva, cliente: DatosCliente): Promise<AreaDto> {
    await this.exigir(this.prisma.area.count({ where: { id } }), 'El área no existe');
    const padreId = datos.padreId ?? null;
    await this.validarPadre(id, padreId);
    const actualizada = await sinDuplicados(
      () =>
        this.prisma.$transaction(async (transaccion) => {
          const area = await transaccion.area.update({
            where: { id },
            data: { nombre: datos.nombre, padreId, activo: datos.activo },
            include: { padre: true },
          });
          await this.registrar('CATALOGO_EDITAR', 'area', id, actor, cliente, { nombre: area.nombre, padreId, activo: area.activo }, transaccion);
          return area;
        }),
      'Ya existe un área con ese nombre en la misma dependencia',
    );
    return {
      id: actualizada.id,
      nombre: actualizada.nombre,
      padreId: actualizada.padreId,
      padreNombre: actualizada.padre?.nombre ?? null,
      activo: actualizada.activo,
    };
  }

  async eliminarArea(id: number, actor: SesionActiva, cliente: DatosCliente): Promise<void> {
    const area = await this.prisma.area.findUnique({ where: { id }, select: { nombre: true } });
    if (area === null) {
      throw new NotFoundException('El área no existe');
    }
    const [vinculos, movimientos, hijas, conteoDocumentos] = await Promise.all([
      this.prisma.vinculo.count({ where: { areaId: id } }),
      this.prisma.movimientoLaboral.count({ where: { OR: [{ areaOrigenId: id }, { areaDestinoId: id }] } }),
      this.prisma.area.count({ where: { padreId: id } }),
      this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT count(*)::int AS total
        FROM documento d
        JOIN tipo_documento t ON t.id = d.tipo_documento_id
        JOIN seccion s ON s.id = t.seccion_id
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(s.campos || t.campos) campo
          WHERE campo->>'tipo' = 'area' AND d.datos -> (campo->>'clave') = to_jsonb(${id}::int)
        )`),
    ]);
    const documentos = conteoDocumentos[0]?.total ?? 0;
    const usos = [
      vinculos > 0 ? `${vinculos} ${vinculos === 1 ? 'vínculo laboral' : 'vínculos laborales'}` : null,
      movimientos > 0 ? `${movimientos} ${movimientos === 1 ? 'movimiento' : 'movimientos'}` : null,
      hijas > 0 ? `${hijas} ${hijas === 1 ? 'área que depende de ella' : 'áreas que dependen de ella'}` : null,
      documentos > 0 ? `${documentos} ${documentos === 1 ? 'documento' : 'documentos'}` : null,
    ].filter((uso): uso is string => uso !== null);
    if (usos.length > 0) {
      throw new ConflictException(`No se puede eliminar «${area.nombre}» porque la usan ${usos.join(', ')}. Desactívala en su lugar.`);
    }
    await this.prisma.$transaction(async (transaccion) => {
      await transaccion.area.delete({ where: { id } });
      await this.registrar('CATALOGO_ELIMINAR', 'area', id, actor, cliente, { nombre: area.nombre }, transaccion);
    });
  }

  async listarCargos(): Promise<PositionDto[]> {
    return this.prisma.cargo.findMany({ orderBy: { nombre: 'asc' } });
  }

  async crearCargo(datos: PositionInputDto, actor: SesionActiva, cliente: DatosCliente): Promise<PositionDto> {
    return sinDuplicados(
      () =>
        this.prisma.$transaction(async (transaccion) => {
          const cargo = await transaccion.cargo.create({ data: datos });
          await this.registrar('CATALOGO_CREAR', 'cargo', cargo.id, actor, cliente, { nombre: cargo.nombre }, transaccion);
          return cargo;
        }),
      'Ya existe un cargo con ese nombre',
    );
  }

  async editarCargo(id: number, datos: PositionInputDto, actor: SesionActiva, cliente: DatosCliente): Promise<PositionDto> {
    await this.exigir(this.prisma.cargo.count({ where: { id } }), 'El cargo no existe');
    return sinDuplicados(
      () =>
        this.prisma.$transaction(async (transaccion) => {
          const cargo = await transaccion.cargo.update({ where: { id }, data: datos });
          await this.registrar('CATALOGO_EDITAR', 'cargo', id, actor, cliente, { ...datos }, transaccion);
          return cargo;
        }),
      'Ya existe un cargo con ese nombre',
    );
  }

  private async validarPadre(id: number | null, padreId: number | null): Promise<void> {
    if (padreId === null) {
      return;
    }
    if (padreId === id) {
      throw new BadRequestException('Un área no puede depender de sí misma');
    }
    let actual: number | null = padreId;
    const visitadas = new Set<number>();
    while (actual !== null) {
      if (actual === id || visitadas.has(actual)) {
        throw new BadRequestException('Esa dependencia formaría un ciclo entre áreas');
      }
      visitadas.add(actual);
      const area: { padreId: number | null } | null = await this.prisma.area.findUnique({
        where: { id: actual },
        select: { padreId: true },
      });
      if (area === null) {
        throw new BadRequestException('El área superior no existe');
      }
      actual = area.padreId;
    }
  }

  private async exigir(conteo: Promise<number>, mensaje: string): Promise<void> {
    if ((await conteo) === 0) {
      throw new NotFoundException(mensaje);
    }
  }

  private registrar(
    accion: 'CATALOGO_CREAR' | 'CATALOGO_EDITAR' | 'CATALOGO_ELIMINAR',
    entidad: 'regimen' | 'area' | 'cargo',
    id: number,
    actor: SesionActiva,
    cliente: DatosCliente,
    detalle: Record<string, string | number | boolean | null>,
    transaccion: Parameters<AuditService['registrar']>[1],
  ): Promise<void> {
    return this.auditoria.registrar(
      { accion, entidad, entidadId: String(id), usuarioId: actor.usuarioId, cliente, detalle },
      transaccion,
    );
  }
}
