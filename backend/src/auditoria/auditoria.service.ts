import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { DatosCliente } from '../comun/cliente';

export interface EventoAuditoria {
  accion: string;
  entidad: string;
  entidadId?: string | null;
  usuarioId?: string | null;
  trabajadorId?: string | null;
  cliente?: DatosCliente;
  detalle?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(evento: EventoAuditoria, transaccion?: Prisma.TransactionClient): Promise<void> {
    const cliente = transaccion ?? this.prisma;
    await cliente.auditoria.create({
      data: {
        accion: evento.accion,
        entidad: evento.entidad,
        entidadId: evento.entidadId ?? null,
        usuarioId: evento.usuarioId ?? null,
        trabajadorId: evento.trabajadorId ?? null,
        ip: evento.cliente?.ip ?? null,
        userAgent: evento.cliente?.userAgent ?? null,
        detalle: evento.detalle,
      },
    });
  }
}
