import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { sinDuplicados } from '../common/unique-violation';
import type { RequirementDto } from './dto/catalog.dto';
import type { CreateRequirementDto } from './dto/catalog-input.dto';
import { aTipoDto } from './document-types.service';
import { aRegimenDto } from './organization.service';

const incluir = { tipoDocumento: true, regimen: true } as const;

type RequisitoCompleto = Prisma.RequisitoGetPayload<{ include: typeof incluir }>;

@Injectable()
export class RequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
  ) {}

  async listar(): Promise<RequirementDto[]> {
    const requisitos = await this.prisma.requisito.findMany({
      include: incluir,
      orderBy: [{ tipoDocumento: { codigo: 'asc' } }, { id: 'asc' }],
    });
    return requisitos.map(aRequisitoDto);
  }

  async crear(datos: CreateRequirementDto, actor: SesionActiva, cliente: DatosCliente): Promise<RequirementDto> {
    const tipo = await this.prisma.tipoDocumento.findUnique({ where: { id: datos.tipoDocumentoId } });
    if (tipo === null || !tipo.activo) {
      throw new BadRequestException('El tipo de documento no existe o está inactivo');
    }
    const regimenId = datos.regimenId ?? null;
    if (regimenId !== null && (await this.prisma.regimen.count({ where: { id: regimenId, activo: true } })) === 0) {
      throw new BadRequestException('El régimen no existe o está inactivo');
    }

    const creado = await sinDuplicados(
      () =>
        this.prisma.$transaction(async (transaccion) => {
          const requisito = await transaccion.requisito.create({
            data: {
              tipoDocumentoId: tipo.id,
              regimenId,
              tipoPersonal: datos.tipoPersonal ?? null,
              aplicaA: datos.aplicaA,
            },
            include: incluir,
          });
          await this.auditoria.registrar(
            {
              accion: 'REQUISITO_CREAR',
              entidad: 'requisito',
              entidadId: String(requisito.id),
              usuarioId: actor.usuarioId,
              cliente,
              detalle: resumen(requisito),
            },
            transaccion,
          );
          return requisito;
        }),
      'Ese documento obligatorio ya está registrado con las mismas condiciones',
    );
    return aRequisitoDto(creado);
  }

  async quitar(id: number, actor: SesionActiva, cliente: DatosCliente): Promise<void> {
    const actual = await this.prisma.requisito.findUnique({ where: { id }, include: incluir });
    if (actual === null) {
      throw new NotFoundException('El documento obligatorio no existe');
    }
    await this.prisma.$transaction(async (transaccion) => {
      await transaccion.requisito.delete({ where: { id } });
      await this.auditoria.registrar(
        {
          accion: 'REQUISITO_QUITAR',
          entidad: 'requisito',
          entidadId: String(id),
          usuarioId: actor.usuarioId,
          cliente,
          detalle: resumen(actual),
        },
        transaccion,
      );
    });
  }
}

function resumen(requisito: RequisitoCompleto): Record<string, string | null> {
  return {
    tipo: requisito.tipoDocumento.codigo,
    regimen: requisito.regimen?.codigo ?? null,
    tipoPersonal: requisito.tipoPersonal,
    aplicaA: requisito.aplicaA,
  };
}

function aRequisitoDto(requisito: RequisitoCompleto): RequirementDto {
  return {
    id: requisito.id,
    tipoDocumento: aTipoDto(requisito.tipoDocumento),
    regimen: requisito.regimen === null ? null : aRegimenDto(requisito.regimen),
    tipoPersonal: requisito.tipoPersonal,
    aplicaA: requisito.aplicaA,
  };
}
