import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { leerDatosGuardados, type ValorCampo } from '../catalogs/section-fields';
import { nombreTrabajador } from '../common/names';
import { GERENTE_MICRORED, JEFE_EESS } from '../seed-catalogs';

export const CODIGO_DESIGNACION = '0704';
export const CARGOS_JEFATURA = [JEFE_EESS, GERENTE_MICRORED] as const;

export type CargoJefatura = (typeof CARGOS_JEFATURA)[number];

export interface Designacion {
  cargo: CargoJefatura;
  campoArea: 'eessDesignado' | 'microredDesignada';
  areaId: number;
  desde: string | null;
  hasta: string | null;
}

export interface DocumentoDeJefatura {
  tipoDocumentoId: number;
  datos: unknown;
  trabajadorId: string;
  documentoId: string | null;
}

export function leerDesignacion(datos: Record<string, ValorCampo>): Designacion | null {
  const cargo = datos['cargoAsignado'];
  if (cargo !== JEFE_EESS && cargo !== GERENTE_MICRORED) {
    return null;
  }
  const campoArea = cargo === GERENTE_MICRORED ? 'microredDesignada' : 'eessDesignado';
  const areaId = datos[campoArea];
  if (typeof areaId !== 'number') {
    return null;
  }
  const desde = datos['fechaInicioFunciones'];
  const hasta = datos['fechaFinFunciones'];
  return {
    cargo,
    campoArea,
    areaId,
    desde: typeof desde === 'string' ? desde : null,
    hasta: typeof hasta === 'string' ? hasta : null,
  };
}

export function seCruzan(a: Pick<Designacion, 'desde' | 'hasta'>, b: Pick<Designacion, 'desde' | 'hasta'>): boolean {
  const aAntesDeB = a.hasta !== null && b.desde !== null && a.hasta < b.desde;
  const bAntesDeA = b.hasta !== null && a.desde !== null && b.hasta < a.desde;
  return !aAntesDeB && !bAntesDeA;
}

export async function exigirJefaturaSinCruce(transaccion: Prisma.TransactionClient, documento: DocumentoDeJefatura): Promise<void> {
  const designacion = leerDesignacion(leerDatosGuardados(documento.datos));
  if (designacion === null) {
    return;
  }
  const tipo = await transaccion.tipoDocumento.findUnique({ where: { id: documento.tipoDocumentoId }, select: { codigo: true } });
  if (tipo?.codigo !== CODIGO_DESIGNACION) {
    return;
  }
  await transaccion.$queryRaw`SELECT id FROM area WHERE id = ${designacion.areaId} FOR UPDATE`;
  const otras = await transaccion.documento.findMany({
    where: {
      tipoDocumento: { codigo: CODIGO_DESIGNACION },
      estado: { not: 'ANULADO' },
      trabajadorId: { not: documento.trabajadorId },
      ...(documento.documentoId === null ? {} : { id: { not: documento.documentoId } }),
      AND: [
        { datos: { path: ['cargoAsignado'], equals: designacion.cargo } },
        { datos: { path: [designacion.campoArea], equals: designacion.areaId } },
      ],
    },
    select: { numero: true, datos: true, trabajador: { select: { nombres: true, apellidoPaterno: true, apellidoMaterno: true } } },
  });
  const cruce = otras
    .map((otra) => ({ otra, existente: leerDesignacion(leerDatosGuardados(otra.datos)) }))
    .find((item): item is { otra: (typeof otras)[number]; existente: Designacion } => item.existente !== null && seCruzan(item.existente, designacion));
  if (cruce === undefined) {
    return;
  }
  const area = await transaccion.area.findUnique({ where: { id: designacion.areaId }, select: { nombre: true } });
  const nombreArea = area?.nombre ?? 'La sede';
  const sede = designacion.cargo === GERENTE_MICRORED ? `${nombreArea} ya tiene gerente` : `${nombreArea} ya tiene jefe`;
  const desde = cruce.existente.desde === null ? 'sin fecha de inicio' : `desde el ${fechaLegible(cruce.existente.desde)}`;
  const hasta = cruce.existente.hasta === null ? 'sin fecha de término' : `hasta el ${fechaLegible(cruce.existente.hasta)}`;
  const resolucion = cruce.otra.numero === null ? '' : ` (N.º ${cruce.otra.numero})`;
  throw new ConflictException(
    `${sede} ${desde} ${hasta}: ${nombreTrabajador(cruce.otra.trabajador)}${resolucion}. Corrige las fechas o anula la designación anterior.`,
  );
}

function fechaLegible(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}
