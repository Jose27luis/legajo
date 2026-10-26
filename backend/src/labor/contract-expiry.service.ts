import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { leerDatosGuardados } from '../catalogs/section-fields';
import type { DatosCliente } from '../common/client';
import { aFecha, aTexto, diaAnterior, diaSiguiente, fechaEnLima, hoyEnLima } from '../common/dates';
import { REFERENCIA_IMPORTACION } from './period-origin';

export interface ActorVencimiento {
  usuarioId: string | null;
  cliente: DatosCliente | null;
}

const SISTEMA: ActorVencimiento = { usuarioId: null, cliente: null };

const SUSTENTOS_VIGENTES = {
  estado: { not: 'ANULADO' },
  tipoDocumento: { accion: 'VINCULO' },
} as const satisfies Prisma.DocumentoWhereInput;

export function esHistorico(fin: string, registradoEn: Date): boolean {
  return fin < fechaEnLima(registradoEn);
}

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
        creadoEn: true,
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
    if (fin === null || fin >= hoyEnLima() || fin < aTexto(vinculo.fechaInicio) || esHistorico(fin, trabajador.creadoEn)) {
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
        select: { id: true, fechaInicio: true, fechaFin: true, referencia: true },
      });
      const limite = siguiente === null ? null : diaAnterior(aTexto(siguiente.fechaInicio));
      if (siguiente !== null && limite !== null && fin > limite) {
        if (siguiente.fechaFin === null && siguiente.referencia === REFERENCIA_IMPORTACION) {
          await transaccion.vinculo.update({ where: { id: siguiente.id }, data: { fechaInicio: aFecha(diaSiguiente(fin)) } });
          await this.auditoria.registrar(
            {
              accion: 'VINCULO_DESPLAZAR',
              entidad: 'vinculo',
              entidadId: siguiente.id,
              trabajadorId: vinculo.trabajadorId,
              usuarioId: actor.usuarioId,
              cliente: actor.cliente ?? undefined,
              detalle: { inicioAnterior: aTexto(siguiente.fechaInicio), inicioNuevo: diaSiguiente(fin), documento: documentoId },
            },
            transaccion,
          );
        } else {
          nuevoFin = limite;
        }
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

  async reabrirHistoricos(): Promise<number> {
    const candidatos = await this.prisma.vinculo.findMany({
      where: {
        actual: true,
        motivoFin: 'FIN_CONTRATO',
        fechaFin: { not: null },
        trabajador: { estado: 'CESADO' },
        documentos: { none: { estado: { not: 'ANULADO' }, tipoDocumento: { accion: 'CESE' } } },
      },
      select: { id: true, trabajadorId: true, fechaFin: true, trabajador: { select: { creadoEn: true } } },
    });
    let reabiertos = 0;
    for (const candidato of candidatos) {
      if (candidato.fechaFin === null || !esHistorico(aTexto(candidato.fechaFin), candidato.trabajador.creadoEn)) {
        continue;
      }
      await this.prisma.$transaction(async (transaccion) => {
        await transaccion.vinculo.update({ where: { id: candidato.id }, data: { fechaFin: null, motivoFin: null } });
        await transaccion.trabajador.update({
          where: { id: candidato.trabajadorId },
          data: { estado: 'ACTIVO', movimientoActual: 'SIN_MOVIMIENTO', movimientoFecha: null },
        });
        await this.auditoria.registrar(
          {
            accion: 'VINCULO_REABRIR',
            entidad: 'vinculo',
            entidadId: candidato.id,
            trabajadorId: candidato.trabajadorId,
            usuarioId: null,
            detalle: { origen: 'contrato_historico', finAnterior: aTexto(candidato.fechaFin ?? new Date()) },
          },
          transaccion,
        );
      });
      reabiertos += 1;
    }
    if (reabiertos > 0) {
      this.bitacora.log(`${reabiertos} trabajador(es) reactivados: su contrato venció antes de registrarse en el sistema`);
    }
    return reabiertos;
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
      select: {
        trabajadorId: true,
        trabajador: { select: { creadoEn: true } },
        documentos: { where: SUSTENTOS_VIGENTES, select: { datos: true } },
      },
    });
    let cesados = 0;
    for (const candidato of candidatos) {
      const fin = finDeContrato(candidato.documentos);
      if (fin === null || fin >= hoy || esHistorico(fin, candidato.trabajador.creadoEn)) {
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
