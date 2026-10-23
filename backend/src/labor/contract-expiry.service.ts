import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { leerDatosGuardados } from '../catalogs/section-fields';
import type { DatosCliente } from '../common/client';
import { aFecha, aTexto, diaAnterior, hoyEnLima } from '../common/dates';

export interface ActorVencimiento {
  usuarioId: string | null;
  cliente: DatosCliente | null;
}

const SISTEMA: ActorVencimiento = { usuarioId: null, cliente: null };

const SUSTENTOS_VIGENTES = {
  estado: { not: 'ANULADO' },
  tipoDocumento: { accion: 'VINCULO' },
} as const satisfies Prisma.DocumentoWhereInput;

export function finDeContrato(documentos: readonly { datos: Prisma.JsonValue }[]): string | null {
  let ultimo: string | null = null;
  for (const documento of documentos) {
    const fin = leerDatosGuardados(documento.datos)['fin'];
    if (typeof fin === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fin) && (ultimo === null || fin > ultimo)) {
      ultimo = fin;
    }
  }
  return ultimo;
}

@Injectable()
export class ContractExpiryService {
  private readonly bitacora = new Logger(ContractExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
  ) {}

  async vencer(transaccion: Prisma.TransactionClient, trabajadorId: string, actor: ActorVencimiento = SISTEMA): Promise<boolean> {
    const trabajador = await transaccion.trabajador.findUnique({
      where: { id: trabajadorId },
      select: {
        id: true,
        estado: true,
        vinculos: {
          where: { actual: true },
          take: 1,
          select: { id: true, fechaInicio: true, fechaFin: true, documentos: { where: SUSTENTOS_VIGENTES, select: { datos: true } } },
        },
      },
    });
    const vinculo = trabajador?.vinculos.at(0);
    if (trabajador === null || trabajador?.estado !== 'ACTIVO' || vinculo === undefined || vinculo.fechaFin !== null) {
      return false;
    }
    const fin = finDeContrato(vinculo.documentos);
    if (fin === null || fin >= hoyEnLima() || fin < aTexto(vinculo.fechaInicio)) {
      return false;
    }
    await transaccion.vinculo.update({ where: { id: vinculo.id }, data: { fechaFin: aFecha(fin), motivoFin: 'FIN_CONTRATO' } });
    await transaccion.trabajador.update({
      where: { id: trabajador.id },
      data: { estado: 'CESADO', movimientoActual: 'SIN_MOVIMIENTO', movimientoFecha: null },
    });
    await this.auditoria.registrar(
      {
        accion: 'VINCULO_FINALIZAR',
        entidad: 'vinculo',
        entidadId: vinculo.id,
        trabajadorId: trabajador.id,
        usuarioId: actor.usuarioId,
        cliente: actor.cliente ?? undefined,
        detalle: { motivo: 'FIN_CONTRATO', fechaCese: fin, origen: 'vencimiento_contrato' },
      },
      transaccion,
    );
    return true;
  }

  async ajustarFin(
    transaccion: Prisma.TransactionClient,
    vinculoId: string,
    actor: ActorVencimiento = SISTEMA,
    documentoId: string | null = null,
  ): Promise<boolean> {
    const vinculo = await transaccion.vinculo.findUnique({
      where: { id: vinculoId },
      select: {
        id: true,
        trabajadorId: true,
        fechaInicio: true,
        fechaFin: true,
        motivoFin: true,
        actual: true,
        documentos: { where: SUSTENTOS_VIGENTES, select: { datos: true } },
      },
    });
    if (vinculo === null || vinculo.motivoFin !== 'FIN_CONTRATO' || vinculo.fechaFin === null) {
      return false;
    }
    const finActual = aTexto(vinculo.fechaFin);
    const fin = finDeContrato(vinculo.documentos);
    if (fin === null || fin === finActual) {
      return false;
    }
    if (fin < finActual) {
      if (fin < aTexto(vinculo.fechaInicio)) {
        return false;
      }
      await transaccion.vinculo.update({ where: { id: vinculo.id }, data: { fechaFin: aFecha(fin) } });
      await this.auditoria.registrar(
        {
          accion: 'VINCULO_ACORTAR',
          entidad: 'vinculo',
          entidadId: vinculo.id,
          trabajadorId: vinculo.trabajadorId,
          usuarioId: actor.usuarioId,
          cliente: actor.cliente ?? undefined,
          detalle: { finAnterior: finActual, finNuevo: fin, documento: documentoId },
        },
        transaccion,
      );
      return true;
    }
    let nuevoFin: string | null = fin;
    if (vinculo.actual) {
      if (fin >= hoyEnLima()) {
        nuevoFin = null;
      }
    } else {
      const siguiente = await transaccion.vinculo.findFirst({
        where: { trabajadorId: vinculo.trabajadorId, id: { not: vinculo.id }, fechaInicio: { gt: vinculo.fechaInicio } },
        orderBy: { fechaInicio: 'asc' },
        select: { fechaInicio: true },
      });
      const limite = siguiente === null ? null : diaAnterior(aTexto(siguiente.fechaInicio));
      if (limite !== null && fin > limite) {
        nuevoFin = limite;
      }
      if (nuevoFin !== null && nuevoFin <= finActual) {
        return false;
      }
    }
    await transaccion.vinculo.update({
      where: { id: vinculo.id },
      data: nuevoFin === null ? { fechaFin: null, motivoFin: null } : { fechaFin: aFecha(nuevoFin) },
    });
    if (nuevoFin === null) {
      await transaccion.trabajador.update({
        where: { id: vinculo.trabajadorId },
        data: { estado: 'ACTIVO', movimientoActual: 'SIN_MOVIMIENTO', movimientoFecha: null },
      });
    }
    await this.auditoria.registrar(
      {
        accion: 'VINCULO_EXTENDER',
        entidad: 'vinculo',
        entidadId: vinculo.id,
        trabajadorId: vinculo.trabajadorId,
        usuarioId: actor.usuarioId,
        cliente: actor.cliente ?? undefined,
        detalle: { finAnterior: finActual, finNuevo: nuevoFin, finContrato: fin, reabierto: nuevoFin === null, documento: documentoId },
      },
      transaccion,
    );
    return true;
  }

  async ajustarTodos(): Promise<number> {
    const candidatos = await this.prisma.vinculo.findMany({
      where: { motivoFin: 'FIN_CONTRATO', fechaFin: { not: null }, documentos: { some: SUSTENTOS_VIGENTES } },
      select: { id: true, fechaFin: true, documentos: { where: SUSTENTOS_VIGENTES, select: { datos: true } } },
    });
    let ajustados = 0;
    for (const candidato of candidatos) {
      const fin = finDeContrato(candidato.documentos);
      if (fin === null || candidato.fechaFin === null || fin === aTexto(candidato.fechaFin)) {
        continue;
      }
      const aplicado = await this.prisma.$transaction((transaccion) => this.ajustarFin(transaccion, candidato.id));
      if (aplicado) {
        ajustados += 1;
      }
    }
    if (ajustados > 0) {
      this.bitacora.log(`${ajustados} período(s) con el fin ajustado a su contrato y adendas`);
    }
    return ajustados;
  }

  async vencerTodos(): Promise<number> {
    const hoy = hoyEnLima();
    const candidatos = await this.prisma.vinculo.findMany({
      where: { actual: true, fechaFin: null, trabajador: { estado: 'ACTIVO' }, documentos: { some: SUSTENTOS_VIGENTES } },
      select: { trabajadorId: true, documentos: { where: SUSTENTOS_VIGENTES, select: { datos: true } } },
    });
    let cesados = 0;
    for (const candidato of candidatos) {
      const fin = finDeContrato(candidato.documentos);
      if (fin === null || fin >= hoy) {
        continue;
      }
      const aplicado = await this.prisma.$transaction((transaccion) => this.vencer(transaccion, candidato.trabajadorId));
      if (aplicado) {
        cesados += 1;
      }
    }
    if (cesados > 0) {
      this.bitacora.log(`${cesados} trabajador(es) cesados por fin de contrato`);
    }
    return cesados;
  }
}
