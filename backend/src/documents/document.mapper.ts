import type { Prisma } from '../generated/prisma/client';
import { aTipoDto } from '../catalogs/document-types.service';
import { leerDatosGuardados } from '../catalogs/section-fields';
import type { SesionActiva } from '../common/session';
import { aTextoOpcional } from '../common/dates';
import type { PartesNombre } from '../common/names';
import type { DocumentDto } from './dto/document.dto';

export const incluirDocumento = {
  tipoDocumento: { include: { seccion: { select: { numero: true, carpeta: true } } } },
  creadoPor: { select: { nombreCompleto: true } },
  modificadoPor: { select: { nombreCompleto: true } },
  confirmadoPor: { select: { nombreCompleto: true } },
  movimiento: { select: { id: true } },
  archivos: { orderBy: { version: 'desc' }, include: { subidoPor: { select: { nombreCompleto: true } } } },
} as const satisfies Prisma.DocumentoInclude;

export type DocumentoCompleto = Prisma.DocumentoGetPayload<{ include: typeof incluirDocumento }>;

const HORAS_DE_CORRECCION = 48;

export function puedeEditar(documento: DocumentoCompleto, sesion: SesionActiva): boolean {
  if (!sesion.permisos.includes('documentos.editar') || documento.estado === 'ANULADO' || documento.estado === 'PROCESANDO') {
    return false;
  }
  if (sesion.rol === 'Administrador') {
    return true;
  }
  const limite = documento.creadoEn.getTime() + HORAS_DE_CORRECCION * 60 * 60 * 1000;
  return documento.creadoPorId === sesion.usuarioId && Date.now() < limite;
}

export function filtroVisibilidad(sesion: SesionActiva): Prisma.DocumentoWhereInput {
  const condiciones: Prisma.DocumentoWhereInput[] = [];
  if (sesion.seccionesRestringidas.length > 0) {
    condiciones.push({ tipoDocumento: { seccion: { numero: { notIn: sesion.seccionesRestringidas } } } });
  }
  if (!sesion.permisos.includes('documentos.restringidos')) {
    condiciones.push({ tipoDocumento: { restringido: false }, nivelAcceso: 'NORMAL' });
  } else if (!sesion.permisos.includes('documentos.muy_restringidos')) {
    condiciones.push({ nivelAcceso: { not: 'MUY_RESTRINGIDO' } });
  }
  return condiciones.length === 0 ? {} : { AND: condiciones };
}

export function seccionPermitida(sesion: SesionActiva, numero: number): boolean {
  return !sesion.seccionesRestringidas.includes(numero);
}

export function aDocumentoDto(documento: DocumentoCompleto, sesion: SesionActiva): DocumentDto {
  return {
    id: documento.id,
    seccion: documento.tipoDocumento.seccion.numero,
    tipo: aTipoDto(documento.tipoDocumento),
    numero: documento.numero,
    fechaEmision: aTextoOpcional(documento.fechaEmision),
    fechaVencimiento: aTextoOpcional(documento.fechaVencimiento),
    emisor: documento.emisor,
    observaciones: documento.observaciones,
    ubicacionFisica: documento.ubicacionFisica,
    datos: leerDatosGuardados(documento.datos),
    nivelAcceso: documento.nivelAcceso,
    estado: documento.estado,
    detalleError: documento.detalleError,
    motivoAnulacion: documento.motivoAnulacion,
    creadoPor: documento.creadoPor.nombreCompleto,
    creadoEn: documento.creadoEn.toISOString(),
    modificadoPor: documento.modificadoPor?.nombreCompleto ?? null,
    modificadoEn: documento.modificadoEn === null ? null : documento.modificadoEn.toISOString(),
    motivoModificacion: documento.motivoModificacion,
    reintentable: documento.subidaPendiente !== null && documento.detalleError !== null && documento.estado !== 'ANULADO',
    editable: puedeEditar(documento, sesion),
    versiones: documento.archivos.map((archivo) => ({
      version: archivo.version,
      nombreOriginal: archivo.nombreOriginal,
      paginas: archivo.paginas,
      tamanoOriginal: Number(archivo.tamanoOriginal),
      tamanoFinal: Number(archivo.tamanoFinal),
      optimizado: archivo.optimizado,
      subidoPor: archivo.subidoPor.nombreCompleto,
      creadoEn: archivo.creadoEn.toISOString(),
      actual: archivo.id === documento.archivoActualId,
    })),
    vinculoId: documento.vinculoId,
    confirmadoPor: documento.confirmadoPor?.nombreCompleto ?? null,
    confirmadoEn: documento.confirmadoEn === null ? null : documento.confirmadoEn.toISOString(),
    movimientoId: documento.movimiento?.id ?? null,
  };
}

export function slug(texto: string, maximo: number): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maximo);
}

export function carpetaTrabajador(trabajador: PartesNombre & { numeroDoc: string }): string {
  return slug(`${trabajador.numeroDoc}_${trabajador.apellidoPaterno}_${trabajador.apellidoMaterno ?? ''}_${trabajador.nombres}`, 90).toUpperCase();
}

export function nombreDescarga(documento: DocumentoCompleto): string {
  const partes = [documento.tipoDocumento.codigo, slug(documento.tipoDocumento.nombre, 60)];
  if (documento.numero !== null) {
    partes.push(slug(documento.numero, 30));
  }
  const fecha = aTextoOpcional(documento.fechaEmision);
  if (fecha !== null) {
    partes.push(fecha);
  }
  return `${partes.filter((parte) => parte !== '').join('_')}.pdf`;
}
