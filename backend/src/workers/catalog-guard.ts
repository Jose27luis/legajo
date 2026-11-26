import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export interface ReferenciasVinculo {
  regimenId: number;
  cargoId: number;
  areaId: number;
}

export async function exigirCatalogosActivos(prisma: PrismaService, datos: ReferenciasVinculo): Promise<void> {
  const [regimen, cargo, area] = await Promise.all([
    prisma.regimen.findUnique({ where: { id: datos.regimenId }, select: { activo: true } }),
    prisma.cargo.findUnique({ where: { id: datos.cargoId }, select: { activo: true } }),
    prisma.area.findUnique({ where: { id: datos.areaId }, select: { activo: true, tipo: true } }),
  ]);
  if (regimen?.activo !== true) {
    throw new BadRequestException('El régimen no existe o está inactivo');
  }
  if (cargo?.activo !== true) {
    throw new BadRequestException('El cargo no existe o está inactivo');
  }
  if (area?.activo !== true) {
    throw new BadRequestException('El área no existe o está inactiva');
  }
  if (area.tipo === 'MICRORED') {
    throw new BadRequestException(MENSAJE_MICRORED);
  }
}

export const MENSAJE_MICRORED = 'Una microred no es un lugar de trabajo: elige el EESS o la dependencia';
