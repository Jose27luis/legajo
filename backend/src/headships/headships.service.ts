import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { leerDatosGuardados } from '../catalogs/section-fields';
import { aTextoOpcional, hoyEnLima } from '../common/dates';
import { nombreTrabajador } from '../common/names';
import type { SesionActiva } from '../common/session';
import { filtroVisibilidad } from '../documents/document.mapper';
import type { AssignmentDto, HeadshipsDto, SituacionAsignacion } from './dto/headship.dto';
import { CARGOS_JEFATURA, CODIGO_DESIGNACION, leerDesignacion, type Designacion } from './headship-rules';

@Injectable()
export class HeadshipsService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(sesion: SesionActiva): Promise<HeadshipsDto> {
    const [establecimientos, microredes, personal, designaciones] = await Promise.all([
      this.prisma.area.findMany({ where: { tipo: 'EESS', activo: true }, include: { padre: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.area.findMany({ where: { tipo: 'MICRORED' }, orderBy: { nombre: 'asc' } }),
      this.prisma.vinculo.groupBy({ by: ['areaId'], where: { actual: true, trabajador: { estado: 'ACTIVO' } }, _count: { _all: true } }),
      this.prisma.documento.findMany({
        where: {
          AND: [
            filtroVisibilidad(sesion),
            {
              tipoDocumento: { codigo: CODIGO_DESIGNACION },
              estado: { not: 'ANULADO' },
              OR: CARGOS_JEFATURA.map((cargo) => ({ datos: { path: ['cargoAsignado'], equals: cargo } })),
            },
          ],
        },
        include: { trabajador: true },
      }),
    ]);
    const hoy = hoyEnLima();
    const porArea = new Map<number, AssignmentDto[]>();
    for (const documento of designaciones) {
      const datos = leerDatosGuardados(documento.datos);
      const designacion = leerDesignacion(datos);
      if (designacion === null) {
        continue;
      }
      const { trabajador } = documento;
      const tipoAccion = datos['tipoAccion'];
      const asignacion: AssignmentDto = {
        documentoId: documento.id,
        trabajadorId: trabajador.id,
        nombre: nombreTrabajador(trabajador),
        documentoIdentidad: `${trabajador.tipoDocIdentidad} ${trabajador.numeroDoc}`,
        trabajadorActivo: trabajador.estado === 'ACTIVO',
        tipoAccion: typeof tipoAccion === 'string' ? tipoAccion : null,
        numero: documento.numero,
        fechaEmision: aTextoOpcional(documento.fechaEmision),
        desde: designacion.desde,
        hasta: designacion.hasta,
        situacion: situacion(designacion, trabajador.estado === 'ACTIVO', hoy),
        disponible: documento.estado === 'DISPONIBLE',
      };
      porArea.set(designacion.areaId, [...(porArea.get(designacion.areaId) ?? []), asignacion]);
    }
    const historialDe = (areaId: number) => (porArea.get(areaId) ?? []).sort(masReciente);
    const actualDe = (historial: AssignmentDto[]) => historial.find((item) => item.situacion === 'VIGENTE' && item.disponible) ?? null;
    const personalPorArea = new Map(personal.map((fila) => [fila.areaId, fila._count._all]));
    const eessPorMicrored = new Map<number, number>();
    for (const establecimiento of establecimientos) {
      if (establecimiento.padre?.tipo === 'MICRORED') {
        eessPorMicrored.set(establecimiento.padre.id, (eessPorMicrored.get(establecimiento.padre.id) ?? 0) + 1);
      }
    }
    return {
      eess: establecimientos.map((establecimiento) => {
        const historial = historialDe(establecimiento.id);
        const microred = establecimiento.padre?.tipo === 'MICRORED' ? establecimiento.padre : null;
        return {
          id: establecimiento.id,
          nombre: establecimiento.nombre,
          microredId: microred?.id ?? null,
          microred: microred?.nombre ?? null,
          personal: personalPorArea.get(establecimiento.id) ?? 0,
          actual: actualDe(historial),
          historial,
        };
      }),
      microredes: microredes.map((microred) => {
        const historial = historialDe(microred.id);
        return {
          id: microred.id,
          nombre: microred.nombre,
          activo: microred.activo,
          eess: eessPorMicrored.get(microred.id) ?? 0,
          actual: actualDe(historial),
          historial,
        };
      }),
    };
  }
}

function situacion(designacion: Pick<Designacion, 'desde' | 'hasta'>, trabajadorActivo: boolean, hoy: string): SituacionAsignacion {
  if (designacion.desde !== null && designacion.desde > hoy) {
    return 'PROXIMA';
  }
  if ((designacion.hasta !== null && designacion.hasta < hoy) || !trabajadorActivo) {
    return 'CONCLUIDA';
  }
  return 'VIGENTE';
}

function masReciente(a: AssignmentDto, b: AssignmentDto): number {
  return (b.desde ?? b.fechaEmision ?? '').localeCompare(a.desde ?? a.fechaEmision ?? '');
}
