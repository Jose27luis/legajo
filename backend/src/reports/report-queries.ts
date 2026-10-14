import { Prisma } from '../generated/prisma/client';
import type { SesionActiva } from '../common/session';
import { seccionesVisiblesSql } from '../search/search-queries';
import type { EstadoValor, TipoPersonalValor } from '../workers/dto/worker.dto';

export interface AmbitoPersonal {
  areaId?: number;
  regimenId?: number;
  tipoPersonal?: TipoPersonalValor;
  cargoId?: number;
  estado?: EstadoValor;
  ingresoDesde?: string | null;
  ingresoHasta?: string | null;
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

export function filtrosPersonal(consulta: AmbitoPersonal): Prisma.Sql[] {
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
  if (consulta.cargoId !== undefined) {
    condiciones.push(Prisma.sql`vi.cargo_id = ${consulta.cargoId}`);
  }
  if (consulta.tipoPersonal !== undefined) {
    condiciones.push(Prisma.sql`vi.tipo_personal = ${consulta.tipoPersonal}::"TipoPersonal"`);
  }
  if (consulta.ingresoDesde !== undefined && consulta.ingresoDesde !== null) {
    condiciones.push(Prisma.sql`t.fecha_ingreso >= ${consulta.ingresoDesde}::date`);
  }
  if (consulta.ingresoHasta !== undefined && consulta.ingresoHasta !== null) {
    condiciones.push(Prisma.sql`t.fecha_ingreso <= ${consulta.ingresoHasta}::date`);
  }
  return condiciones;
}

export function tiposVisibles(sesion: SesionActiva): Prisma.Sql {
  const secciones = seccionesVisiblesSql(sesion);
  return sesion.permisos.includes('documentos.restringidos') ? secciones : Prisma.sql`(${secciones} AND td.restringido = FALSE)`;
}

export function visibilidadDocumento(sesion: SesionActiva, alias: 'd' | 'dd'): Prisma.Sql {
  const columna = alias === 'd' ? Prisma.sql`d.nivel_acceso` : Prisma.sql`dd.nivel_acceso`;
  if (!sesion.permisos.includes('documentos.restringidos')) {
    return Prisma.sql`${columna} = 'NORMAL'`;
  }
  if (!sesion.permisos.includes('documentos.muy_restringidos')) {
    return Prisma.sql`${columna} <> 'MUY_RESTRINGIDO'`;
  }
  return Prisma.sql`TRUE`;
}

export function baseCompletitud(consulta: AmbitoPersonal, sesion: SesionActiva, hoy: string, soloIds?: string[]): Prisma.Sql {
  const condiciones = filtrosPersonal(consulta);
  if (soloIds !== undefined) {
    condiciones.push(soloIds.length === 0 ? Prisma.sql`FALSE` : Prisma.sql`t.id IN (${Prisma.join(soloIds.map((id) => Prisma.sql`${id}::uuid`))})`);
  }
  return Prisma.sql`
  WITH base AS (
    SELECT t.id, t.numero_doc, t.nombres, t.apellido_paterno, t.apellido_materno, t.estado, t.fecha_ingreso,
           vi.regimen_id, vi.tipo_personal, vi.area_id, vi.cargo_id
    FROM trabajador t
    ${VINCULO_ACTUAL}
    WHERE ${unir(condiciones)}
  ),
  exigidos AS (
    SELECT b.id AS trabajador_id, td.id AS tipo_id, td.codigo, td.nombre, td.tiene_vencimiento, s.numero AS seccion
    FROM base b
    JOIN requisito r
      ON (r.regimen_id IS NULL OR r.regimen_id = b.regimen_id)
     AND (r.tipo_personal IS NULL OR r.tipo_personal = b.tipo_personal)
     AND (r.aplica_a = 'TODOS' OR r.aplica_a::text = b.estado::text)
    JOIN tipo_documento td ON td.id = r.tipo_documento_id AND td.activo
    JOIN seccion s ON s.id = td.seccion_id
    WHERE ${tiposVisibles(sesion)}
    GROUP BY b.id, td.id, td.codigo, td.nombre, td.tiene_vencimiento, s.numero
  ),
  estados AS (
    SELECT e.trabajador_id, e.tipo_id, e.codigo, e.nombre, e.seccion,
           dd.id AS documento_id, dd.fecha_emision, dd.fecha_vencimiento,
           CASE
             WHEN dd.id IS NULL THEN 'FALTANTE'
             WHEN e.tiene_vencimiento AND dd.fecha_vencimiento IS NOT NULL AND dd.fecha_vencimiento < ${hoy}::date THEN 'VENCIDO'
             ELSE 'COMPLETO'
           END AS situacion
    FROM exigidos e
    LEFT JOIN LATERAL (
      SELECT dd.id, dd.fecha_emision, dd.fecha_vencimiento
      FROM documento dd
      WHERE dd.trabajador_id = e.trabajador_id
        AND dd.tipo_documento_id = e.tipo_id
        AND dd.estado = 'DISPONIBLE'
        AND ${visibilidadDocumento(sesion, 'dd')}
      ORDER BY dd.fecha_emision DESC NULLS LAST, dd.creado_en DESC
      LIMIT 1
    ) dd ON TRUE
  ),
  resumen AS (
    SELECT trabajador_id,
           count(*)::int AS requisitos,
           count(*) FILTER (WHERE situacion = 'COMPLETO')::int AS completos,
           count(*) FILTER (WHERE situacion = 'VENCIDO')::int AS vencidos,
           count(*) FILTER (WHERE situacion = 'FALTANTE')::int AS faltantes
    FROM estados
    GROUP BY trabajador_id
  )`;
}

export const PERSONAL_SELECT = Prisma.sql`
  SELECT b.id, b.numero_doc, b.nombres, b.apellido_paterno, b.apellido_materno, b.estado, b.fecha_ingreso,
         b.tipo_personal, rg.nombre AS regimen, c.nombre AS cargo, a.nombre AS area,
         coalesce(r.requisitos, 0) AS requisitos,
         coalesce(r.completos, 0) AS completos,
         coalesce(r.vencidos, 0) AS vencidos,
         coalesce(r.faltantes, 0) AS faltantes
  FROM base b
  LEFT JOIN resumen r ON r.trabajador_id = b.id
  LEFT JOIN regimen rg ON rg.id = b.regimen_id
  LEFT JOIN cargo c ON c.id = b.cargo_id
  LEFT JOIN area a ON a.id = b.area_id`;

export const ORDEN_PERSONAL = Prisma.sql`ORDER BY b.apellido_paterno, b.apellido_materno, b.nombres`;

export const AVANCE_SELECT = Prisma.sql`
  SELECT coalesce(a.nombre, 'Sin área') AS area,
         count(*)::int AS trabajadores,
         count(*) FILTER (WHERE coalesce(r.requisitos, 0) = 0 OR coalesce(r.completos, 0) = r.requisitos)::int AS completos,
         count(*) FILTER (WHERE coalesce(r.completos, 0) > 0 AND coalesce(r.completos, 0) < coalesce(r.requisitos, 0))::int AS parciales,
         count(*) FILTER (WHERE coalesce(r.requisitos, 0) > 0 AND coalesce(r.completos, 0) = 0)::int AS vacios,
         coalesce(sum(coalesce(r.completos, 0))::float8, 0) AS logrados,
         coalesce(sum(coalesce(r.requisitos, 0))::float8, 0) AS exigidos
  FROM base b
  LEFT JOIN resumen r ON r.trabajador_id = b.id
  LEFT JOIN area a ON a.id = b.area_id
  GROUP BY coalesce(a.nombre, 'Sin área')
  ORDER BY coalesce(a.nombre, 'Sin área')`;
