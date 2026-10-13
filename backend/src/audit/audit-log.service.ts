import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import type { DatosCliente } from '../common/client';
import { diaSiguiente, hoyEnLima } from '../common/dates';
import { nombreTrabajador } from '../common/names';
import type { SesionActiva } from '../common/session';
import { enviarLibro, type CeldaValor, type ColumnaHoja } from '../common/xlsx-stream';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import type { AuditEntryDto, AuditOptionsDto, AuditPageDto } from './dto/audit-entry.dto';
import type { AuditFiltersDto, AuditQueryDto } from './dto/audit-query.dto';

const POR_PAGINA = 50;
const BLOQUE = 1000;

const formatoFechaHora = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const SELECCION = {
  id: true,
  fecha: true,
  accion: true,
  entidad: true,
  entidadId: true,
  ip: true,
  userAgent: true,
  detalle: true,
  usuario: { select: { id: true, usuario: true, nombreCompleto: true } },
  trabajador: { select: { id: true, numeroDoc: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true } },
} satisfies Prisma.AuditoriaSelect;

type FilaAuditoria = Prisma.AuditoriaGetPayload<{ select: typeof SELECCION }>;

function inicioDelDia(texto: string): Date {
  return new Date(`${texto}T00:00:00.000-05:00`);
}

function aEntradaDto(fila: FilaAuditoria): AuditEntryDto {
  return {
    id: fila.id.toString(),
    fecha: fila.fecha.toISOString(),
    usuario: fila.usuario === null ? null : { id: fila.usuario.id, usuario: fila.usuario.usuario, nombre: fila.usuario.nombreCompleto },
    accion: fila.accion,
    entidad: fila.entidad,
    entidadId: fila.entidadId,
    trabajador:
      fila.trabajador === null
        ? null
        : { id: fila.trabajador.id, numeroDoc: fila.trabajador.numeroDoc, nombre: nombreTrabajador(fila.trabajador) },
    ip: fila.ip,
    navegador: fila.userAgent,
    detalle: fila.detalle === null ? null : JSON.stringify(fila.detalle),
  };
}

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
  ) {}

  async listar(consulta: AuditQueryDto): Promise<AuditPageDto> {
    const pagina = consulta.pagina ?? 1;
    const donde = this.condiciones(consulta);
    const [filas, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where: donde,
        select: SELECCION,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        take: POR_PAGINA,
        skip: (pagina - 1) * POR_PAGINA,
      }),
      this.prisma.auditoria.count({ where: donde }),
    ]);
    return { items: filas.map(aEntradaDto), total, pagina, porPagina: POR_PAGINA };
  }

  async opciones(): Promise<AuditOptionsDto> {
    const [acciones, usuarios] = await Promise.all([
      this.prisma.$queryRaw<{ accion: string }[]>(Prisma.sql`SELECT DISTINCT accion FROM auditoria ORDER BY accion`),
      this.prisma.usuario.findMany({ select: { id: true, usuario: true, nombreCompleto: true }, orderBy: { nombreCompleto: 'asc' } }),
    ]);
    return {
      acciones: acciones.map((fila) => fila.accion),
      usuarios: usuarios.map((usuario) => ({ id: usuario.id, usuario: usuario.usuario, nombre: usuario.nombreCompleto })),
    };
  }

  async exportar(consulta: AuditFiltersDto, sesion: SesionActiva, cliente: DatosCliente, respuesta: Response): Promise<void> {
    const filtros: Record<string, string> = {};
    for (const [clave, valor] of Object.entries(consulta)) {
      if (typeof valor === 'string') {
        filtros[clave] = valor;
      }
    }
    await this.auditoria.registrar({
      accion: 'REPORTE_EXPORTAR',
      entidad: 'reporte',
      entidadId: 'auditoria',
      usuarioId: sesion.usuarioId,
      cliente,
      detalle: { reporte: 'auditoria', filtros },
    });
    const columnas: ColumnaHoja[] = [
      { titulo: 'Fecha y hora', ancho: 20 },
      { titulo: 'Usuario', ancho: 18 },
      { titulo: 'Nombre del usuario', ancho: 30 },
      { titulo: 'Acción', ancho: 30 },
      { titulo: 'Entidad', ancho: 18 },
      { titulo: 'Id de la entidad', ancho: 38 },
      { titulo: 'Documento del trabajador', ancho: 14 },
      { titulo: 'Trabajador', ancho: 36 },
      { titulo: 'IP', ancho: 16 },
      { titulo: 'Navegador', ancho: 40 },
      { titulo: 'Detalle', ancho: 60 },
    ];
    await enviarLibro(respuesta, {
      nombreArchivo: `auditoria_${hoyEnLima()}`,
      hoja: 'Auditoría',
      columnas,
      filas: this.porBloques(this.condiciones(consulta)),
    });
  }

  private async *porBloques(donde: Prisma.AuditoriaWhereInput): AsyncGenerator<CeldaValor[]> {
    let ultimo: bigint | null = null;
    for (;;) {
      const bloque: FilaAuditoria[] = await this.prisma.auditoria.findMany({
        where: ultimo === null ? donde : { AND: [donde, { id: { lt: ultimo } }] },
        select: SELECCION,
        orderBy: { id: 'desc' },
        take: BLOQUE,
      });
      for (const fila of bloque) {
        const item = aEntradaDto(fila);
        yield [
          formatoFechaHora.format(fila.fecha),
          item.usuario?.usuario ?? null,
          item.usuario?.nombre ?? null,
          item.accion,
          item.entidad,
          item.entidadId,
          item.trabajador?.numeroDoc ?? null,
          item.trabajador?.nombre ?? null,
          item.ip,
          item.navegador,
          item.detalle,
        ];
      }
      if (bloque.length < BLOQUE) {
        return;
      }
      ultimo = bloque[bloque.length - 1].id;
    }
  }

  private condiciones(consulta: AuditFiltersDto): Prisma.AuditoriaWhereInput {
    const donde: Prisma.AuditoriaWhereInput[] = [];
    if (consulta.usuarioId) {
      donde.push({ usuarioId: consulta.usuarioId });
    }
    if (consulta.accion) {
      donde.push({ accion: consulta.accion });
    }
    if (consulta.trabajadorId) {
      donde.push({ trabajadorId: consulta.trabajadorId });
    }
    if (consulta.numeroDoc) {
      donde.push({ trabajador: { numeroDoc: consulta.numeroDoc } });
    }
    if (consulta.desde) {
      donde.push({ fecha: { gte: inicioDelDia(consulta.desde) } });
    }
    if (consulta.hasta) {
      donde.push({ fecha: { lt: inicioDelDia(diaSiguiente(consulta.hasta)) } });
    }
    return { AND: donde };
  }
}
