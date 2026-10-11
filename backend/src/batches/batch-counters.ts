import type { Prisma } from '../generated/prisma/client';

export async function bloquearLote(transaccion: Prisma.TransactionClient, loteId: string): Promise<void> {
  await transaccion.$queryRaw`SELECT id FROM lote_carga WHERE id = ${loteId}::uuid FOR UPDATE`;
}

export async function recalcularLote(transaccion: Prisma.TransactionClient, loteId: string): Promise<void> {
  const grupos = await transaccion.loteItem.groupBy({ by: ['estado'], where: { loteId }, _count: { _all: true } });
  const cuenta = (estado: string) => grupos.find((grupo) => grupo.estado === estado)?._count._all ?? 0;
  const subiendo = cuenta('SUBIENDO');
  const pendientes = cuenta('PENDIENTE');
  const estado = subiendo > 0 ? 'SUBIENDO' : pendientes > 0 ? 'EN_BANDEJA' : 'TERMINADO';
  const actual = await transaccion.loteCarga.findUniqueOrThrow({ where: { id: loteId }, select: { terminadoEn: true } });
  await transaccion.loteCarga.update({
    where: { id: loteId },
    data: {
      clasificados: cuenta('CLASIFICADO') + cuenta('DIVIDIDO'),
      pendientes,
      conError: cuenta('ERROR'),
      estado,
      terminadoEn: estado === 'TERMINADO' ? (actual.terminadoEn ?? new Date()) : null,
    },
  });
}
