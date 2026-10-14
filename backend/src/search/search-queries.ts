import { Prisma } from '../generated/prisma/client';
import type { SesionActiva } from '../common/session';
import type { SearchQueryDto } from './dto/search-query.dto';
import type { TextoBusqueda } from './search-text';

export interface CatalogosCoincidentes {
  areas: number[];
  cargos: number[];
  tipos: number[];
}

export const VINCULO_ACTUAL = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT v.regimen_id, v.tipo_personal, v.area_id, v.cargo_id
    FROM vinculo v
    WHERE v.trabajador_id = t.id
    ORDER BY v.actual DESC, v.fecha_inicio DESC
    LIMIT 1
  ) vi ON TRUE`;

export function unir(condiciones: Prisma.Sql[]): Prisma.Sql {
  return condiciones.length === 0 ? Prisma.sql`TRUE` : Prisma.join(condiciones, ' AND ');
}

export function seccionesVisiblesSql(sesion: SesionActiva): Prisma.Sql {
  if (sesion.seccionesRestringidas.length === 0) {
    return Prisma.sql`TRUE`;
  }
  return Prisma.sql`td.seccion_id NOT IN (SELECT s.id FROM seccion s WHERE s.numero IN (${Prisma.join(sesion.seccionesRestringidas)}))`;
}

export function visibilidadSql(sesion: SesionActiva): Prisma.Sql {
  const secciones = seccionesVisiblesSql(sesion);
  if (!sesion.permisos.includes('documentos.restringidos')) {
    return Prisma.sql`(${secciones} AND td.restringido = FALSE AND d.nivel_acceso = 'NORMAL')`;
  }
  if (!sesion.permisos.includes('documentos.muy_restringidos')) {
    return Prisma.sql`(${secciones} AND d.nivel_acceso <> 'MUY_RESTRINGIDO')`;
  }
  return secciones;
}

export function filtrosTrabajador(consulta: SearchQueryDto): Prisma.Sql[] {
  const condiciones: Prisma.Sql[] = [];
  if (consulta.estado !== undefined) {
    condiciones.push(Prisma.sql`t.estado = ${consulta.estado}::"EstadoTrabajador"`);
  }
  if (consulta.areaId !== undefined) {
    condiciones.push(Prisma.sql`vi.area_id = ${consulta.areaId}`);
  }
  if (consulta.regimenId !== undefined) {
    condiciones.push(Prisma.sql`vi.regimen_id = ${consulta.regimenId}`);
  }
  if (consulta.tipoPersonal !== undefined) {
    condiciones.push(Prisma.sql`vi.tipo_personal = ${consulta.tipoPersonal}::"TipoPersonal"`);
  }
  if (consulta.trabajadorId !== undefined && consulta.trabajadorId !== null) {
    condiciones.push(Prisma.sql`t.id = ${consulta.trabajadorId}::uuid`);
  }
  return condiciones;
}

export function filtrosDocumento(consulta: SearchQueryDto, sesion: SesionActiva): Prisma.Sql[] {
  const condiciones: Prisma.Sql[] = [visibilidadSql(sesion)];
  const estado = consulta.estadoDocumento ?? 'DISPONIBLE';
  if (estado !== 'TODOS') {
    condiciones.push(Prisma.sql`d.estado = ${estado}::"EstadoDocumento"`);
  }
  if (consulta.seccion !== undefined) {
    condiciones.push(Prisma.sql`s.numero = ${consulta.seccion}`);
  }
  if (consulta.tipoDocumentoId !== undefined) {
    condiciones.push(Prisma.sql`d.tipo_documento_id = ${consulta.tipoDocumentoId}`);
  }
  if (consulta.desde !== undefined && consulta.desde !== null) {
    condiciones.push(Prisma.sql`d.fecha_emision >= ${consulta.desde}::date`);
  }
  if (consulta.hasta !== undefined && consulta.hasta !== null) {
    condiciones.push(Prisma.sql`d.fecha_emision <= ${consulta.hasta}::date`);
  }
  return condiciones;
}

export function textoTrabajador(texto: TextoBusqueda, catalogos: CatalogosCoincidentes): Prisma.Sql {
  if (texto.clase === 'IDENTIDAD') {
    return Prisma.sql`t.numero_doc LIKE ${`${texto.texto}%`}`;
  }
  if (texto.clase === 'NUMERO') {
    return Prisma.sql`FALSE`;
  }
  const alternativas: Prisma.Sql[] = [unir(texto.palabras.map((palabra) => Prisma.sql`t.nombre_busqueda LIKE ${`%${palabra}%`}`))];
  if (catalogos.areas.length > 0) {
    alternativas.push(Prisma.sql`vi.area_id IN (${Prisma.join(catalogos.areas)})`);
  }
  if (catalogos.cargos.length > 0) {
    alternativas.push(Prisma.sql`vi.cargo_id IN (${Prisma.join(catalogos.cargos)})`);
  }
  return Prisma.sql`(${Prisma.join(alternativas, ' OR ')})`;
}

export function textoDocumento(texto: TextoBusqueda, catalogos: CatalogosCoincidentes): Prisma.Sql {
  if (texto.clase === 'IDENTIDAD') {
    return Prisma.sql`t.numero_doc LIKE ${`${texto.texto}%`}`;
  }
  const parcial = `%${texto.texto.toLowerCase()}%`;
  if (texto.clase === 'NUMERO') {
    return Prisma.sql`lower(d.numero) LIKE ${parcial}`;
  }
  const alternativas: Prisma.Sql[] = [
    Prisma.sql`lower(d.numero) LIKE ${parcial}`,
    Prisma.sql`lower(d.emisor) LIKE ${parcial}`,
    Prisma.sql`lower(d.observaciones) LIKE ${parcial}`,
  ];
  if (catalogos.tipos.length > 0) {
    alternativas.push(Prisma.sql`d.tipo_documento_id IN (${Prisma.join(catalogos.tipos)})`);
  }
  return Prisma.sql`(${Prisma.join(alternativas, ' OR ')})`;
}

export function ordenTrabajador(texto: TextoBusqueda | null): Prisma.Sql {
  if (texto?.clase === 'NOMBRE') {
    return Prisma.sql`similarity(t.nombre_busqueda, ${texto.normalizado}) DESC, t.apellido_paterno, t.apellido_materno, t.nombres`;
  }
  return Prisma.sql`t.apellido_paterno, t.apellido_materno, t.nombres`;
}

export function ordenDocumento(texto: TextoBusqueda | null): Prisma.Sql {
  if (texto?.clase === 'NUMERO') {
    return Prisma.sql`similarity(lower(coalesce(d.numero, '')), ${texto.normalizado}) DESC, d.fecha_emision DESC NULLS LAST`;
  }
  return Prisma.sql`d.fecha_emision DESC NULLS LAST, d.creado_en DESC`;
}
