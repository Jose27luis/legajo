import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import type { TipoDocumento } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { sinDuplicados } from '../common/unique-violation';
import { TIPOS_CAMPO, type DocumentTypeDto, type SectionDto, type SectionFieldDto } from './dto/catalog.dto';
import type { CreateDocumentTypeDto, UpdateDocumentTypeDto } from './dto/catalog-input.dto';

const esquemaCampos = z.array(
  z.object({
    clave: z.string(),
    etiqueta: z.string(),
    tipo: z.enum(TIPOS_CAMPO),
    opciones: z.array(z.string()).optional(),
    obligatorio: z.boolean(),
  }),
);

const ULTIMO_CORRELATIVO = 98;

export function aTipoDto(tipo: TipoDocumento): DocumentTypeDto {
  return {
    id: tipo.id,
    seccionId: tipo.seccionId,
    codigo: tipo.codigo,
    nombre: tipo.nombre,
    restringido: tipo.restringido,
    requiereNumero: tipo.requiereNumero,
    tieneVencimiento: tipo.tieneVencimiento,
    activo: tipo.activo,
    orden: tipo.orden,
  };
}

@Injectable()
export class DocumentTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
  ) {}

  async listarSecciones(): Promise<SectionDto[]> {
    const secciones = await this.prisma.seccion.findMany({
      orderBy: { numero: 'asc' },
      include: { tipos: { orderBy: [{ orden: 'asc' }, { codigo: 'asc' }] } },
    });
    return secciones.map((seccion) => ({
      id: seccion.id,
      numero: seccion.numero,
      nombre: seccion.nombre,
      carpeta: seccion.carpeta,
      descripcion: seccion.descripcion,
      campos: this.leerCampos(seccion.campos),
      tipos: seccion.tipos.map(aTipoDto),
    }));
  }

  async crear(datos: CreateDocumentTypeDto, actor: SesionActiva, cliente: DatosCliente): Promise<DocumentTypeDto> {
    const seccion = await this.prisma.seccion.findUnique({ where: { id: datos.seccionId } });
    if (seccion === null) {
      throw new BadRequestException('La sección no existe');
    }
    const prefijo = String(seccion.numero).padStart(2, '0');
    const usados = await this.prisma.tipoDocumento.findMany({
      where: { seccionId: seccion.id },
      select: { codigo: true },
    });
    const correlativos = usados.map((tipo) => Number(tipo.codigo.slice(2))).filter((valor) => valor <= ULTIMO_CORRELATIVO);
    const siguiente = (correlativos.length === 0 ? 0 : Math.max(...correlativos)) + 1;
    if (siguiente > ULTIMO_CORRELATIVO) {
      throw new BadRequestException('La sección ya no tiene códigos disponibles');
    }
    const codigo = `${prefijo}${String(siguiente).padStart(2, '0')}`;

    const creado = await sinDuplicados(
      () =>
        this.prisma.$transaction(async (transaccion) => {
          const tipo = await transaccion.tipoDocumento.create({
            data: {
              seccionId: seccion.id,
              codigo,
              nombre: datos.nombre,
              restringido: datos.restringido,
              requiereNumero: datos.requiereNumero,
              tieneVencimiento: datos.tieneVencimiento,
              orden: siguiente,
            },
          });
          await this.auditoria.registrar(
            {
              accion: 'CATALOGO_CREAR',
              entidad: 'tipo_documento',
              entidadId: String(tipo.id),
              usuarioId: actor.usuarioId,
              cliente,
              detalle: { codigo: tipo.codigo, nombre: tipo.nombre },
            },
            transaccion,
          );
          return tipo;
        }),
      'Otro tipo tomó ese código al mismo tiempo. Intenta de nuevo.',
    );
    return aTipoDto(creado);
  }

  async editar(id: number, datos: UpdateDocumentTypeDto, actor: SesionActiva, cliente: DatosCliente): Promise<DocumentTypeDto> {
    const actual = await this.prisma.tipoDocumento.findUnique({ where: { id } });
    if (actual === null) {
      throw new NotFoundException('El tipo de documento no existe');
    }
    const actualizado = await this.prisma.$transaction(async (transaccion) => {
      const tipo = await transaccion.tipoDocumento.update({
        where: { id },
        data: {
          nombre: datos.nombre,
          restringido: datos.restringido,
          requiereNumero: datos.requiereNumero,
          tieneVencimiento: datos.tieneVencimiento,
          activo: datos.activo,
          orden: datos.orden,
        },
      });
      await this.auditoria.registrar(
        {
          accion: 'CATALOGO_EDITAR',
          entidad: 'tipo_documento',
          entidadId: String(id),
          usuarioId: actor.usuarioId,
          cliente,
          detalle: { antes: aTipoDtoJson(actual), despues: aTipoDtoJson(tipo) },
        },
        transaccion,
      );
      return tipo;
    });
    return aTipoDto(actualizado);
  }

  private leerCampos(valor: unknown): SectionFieldDto[] {
    const resultado = esquemaCampos.safeParse(valor);
    if (!resultado.success) {
      throw new Error('La definición de campos de una sección no es válida');
    }
    return resultado.data;
  }
}

function aTipoDtoJson(tipo: TipoDocumento): Record<string, string | number | boolean> {
  return {
    codigo: tipo.codigo,
    nombre: tipo.nombre,
    restringido: tipo.restringido,
    requiereNumero: tipo.requiereNumero,
    tieneVencimiento: tipo.tieneVencimiento,
    activo: tipo.activo,
    orden: tipo.orden,
  };
}
