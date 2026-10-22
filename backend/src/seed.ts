import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { PrismaClient, type Prisma } from './generated/prisma/client';
import { CARGOS_INSTITUCIONALES, ESTABLECIMIENTOS, MICROREDES, SEDE_DIRESA, SIN_MICRORED, UNIDADES_DIRESA } from './organization-catalogs';
import { REGIMENES, REQUISITOS, SECCIONES, SECCIONES_RESTRINGIDAS_POR_ROL, TIPOS_DOCUMENTO } from './seed-catalogs';

const vacioAIndefinido = (valor: unknown) => (valor === '' ? undefined : valor);

const esquemaAdministrador = z.object({
  ADMIN_USUARIO: z.string().regex(/^[a-z0-9._-]{4,30}$/),
  ADMIN_NOMBRE: z.string().trim().min(1).max(120),
  ADMIN_CORREO: z.email().transform((correo) => correo.toLowerCase()),
  ADMIN_CLAVE: z.string().min(10).max(100),
});

const esquemaSemilla = z.object({
  DATABASE_URL: z.url(),
  ADMIN_USUARIO: z.preprocess(vacioAIndefinido, z.string().optional()),
  ADMIN_NOMBRE: z.preprocess(vacioAIndefinido, z.string().optional()),
  ADMIN_CORREO: z.preprocess(vacioAIndefinido, z.string().optional()),
  ADMIN_CLAVE: z.preprocess(vacioAIndefinido, z.string().optional()),
});

const PERMISOS: ReadonlyArray<{ codigo: string; modulo: string; descripcion: string }> = [
  { codigo: 'usuarios.gestionar', modulo: 'usuarios', descripcion: 'Crear y administrar usuarios y roles' },
  { codigo: 'catalogos.gestionar', modulo: 'catalogos', descripcion: 'Administrar tipos de documento, requisitos, regímenes, áreas y cargos' },
  { codigo: 'personal.ver', modulo: 'personal', descripcion: 'Consultar trabajadores' },
  { codigo: 'personal.editar', modulo: 'personal', descripcion: 'Registrar y editar trabajadores, vínculos y ceses' },
  { codigo: 'documentos.ver', modulo: 'documentos', descripcion: 'Ver documentos del legajo' },
  { codigo: 'documentos.subir', modulo: 'documentos', descripcion: 'Subir documentos' },
  { codigo: 'documentos.editar', modulo: 'documentos', descripcion: 'Editar datos y reemplazar documentos' },
  { codigo: 'documentos.anular', modulo: 'documentos', descripcion: 'Anular documentos' },
  { codigo: 'documentos.descargar', modulo: 'documentos', descripcion: 'Descargar documentos y legajos' },
  { codigo: 'documentos.restringidos', modulo: 'documentos', descripcion: 'Ver documentos restringidos' },
  { codigo: 'documentos.muy_restringidos', modulo: 'documentos', descripcion: 'Ver documentos muy restringidos' },
  { codigo: 'carga_masiva.usar', modulo: 'carga_masiva', descripcion: 'Usar la carga masiva' },
  { codigo: 'reportes.ver', modulo: 'reportes', descripcion: 'Ver reportes' },
  { codigo: 'reportes.exportar', modulo: 'reportes', descripcion: 'Exportar reportes' },
  { codigo: 'auditoria.ver', modulo: 'auditoria', descripcion: 'Consultar la auditoría' },
  { codigo: 'backup.gestionar', modulo: 'backup', descripcion: 'Administrar copias de seguridad' },
];

const ROLES: ReadonlyArray<{ nombre: string; descripcion: string; permisos: readonly string[] }> = [
  {
    nombre: 'Administrador',
    descripcion: 'Configuración y gestión completa del sistema',
    permisos: PERMISOS.map((permiso) => permiso.codigo),
  },
  {
    nombre: 'Operador',
    descripcion: 'Registro de trabajadores y documentos',
    permisos: [
      'personal.ver',
      'personal.editar',
      'documentos.ver',
      'documentos.subir',
      'documentos.editar',
      'documentos.anular',
      'documentos.descargar',
      'documentos.restringidos',
      'carga_masiva.usar',
      'reportes.ver',
      'reportes.exportar',
    ],
  },
  {
    nombre: 'Consulta',
    descripcion: 'Solo lectura',
    permisos: ['personal.ver', 'documentos.ver', 'documentos.descargar', 'reportes.ver', 'reportes.exportar'],
  },
];

async function sembrarCatalogos(transaccion: Prisma.TransactionClient): Promise<void> {
  const idsSeccion = new Map<number, number>();
  for (const seccion of SECCIONES) {
    const guardada = await transaccion.seccion.upsert({
      where: { numero: seccion.numero },
      create: { ...seccion, campos: seccion.campos },
      update: { nombre: seccion.nombre, carpeta: seccion.carpeta, descripcion: seccion.descripcion, campos: seccion.campos },
    });
    idsSeccion.set(seccion.numero, guardada.id);
  }

  const existentes = new Set(
    (await transaccion.tipoDocumento.findMany({ select: { codigo: true } })).map((tipo) => tipo.codigo),
  );
  for (const [indice, tipo] of TIPOS_DOCUMENTO.entries()) {
    const seccionId = idsSeccion.get(Number(tipo.codigo.slice(0, 2)));
    if (seccionId === undefined) {
      throw new Error(`El tipo ${tipo.codigo} no corresponde a ninguna sección`);
    }
    const sistema = {
      nombre: tipo.nombre,
      accion: tipo.accion,
      campos: tipo.campos,
      formulario: tipo.formulario,
      requiereNumero: tipo.requiereNumero,
      tieneVencimiento: tipo.tieneVencimiento,
      orden: indice + 1,
    };
    if (existentes.has(tipo.codigo)) {
      await transaccion.tipoDocumento.update({ where: { codigo: tipo.codigo }, data: sistema });
      continue;
    }
    await transaccion.tipoDocumento.create({
      data: {
        codigo: tipo.codigo,
        restringido: tipo.restringido,
        seccionId,
        ...sistema,
      },
    });
  }

  for (const regimen of REGIMENES) {
    await transaccion.regimen.upsert({ where: { codigo: regimen.codigo }, create: regimen, update: {} });
  }

  if ((await transaccion.rolSeccionRestringida.count()) === 0) {
    const roles = await transaccion.rol.findMany({
      where: { nombre: { in: Object.keys(SECCIONES_RESTRINGIDAS_POR_ROL) } },
      select: { id: true, nombre: true },
    });
    const filas = roles.flatMap((rol) =>
      (SECCIONES_RESTRINGIDAS_POR_ROL[rol.nombre] ?? []).flatMap((numero) => {
        const seccionId = idsSeccion.get(numero);
        return seccionId === undefined ? [] : [{ rolId: rol.id, seccionId }];
      }),
    );
    if (filas.length > 0) {
      await transaccion.rolSeccionRestringida.createMany({ data: filas });
    }
  }

  if ((await transaccion.requisito.count()) > 0) {
    return;
  }
  const tipos = new Map(
    (await transaccion.tipoDocumento.findMany({ select: { id: true, codigo: true } })).map((tipo) => [tipo.codigo, tipo.id]),
  );
  const regimenes = new Map(
    (await transaccion.regimen.findMany({ select: { id: true, codigo: true } })).map((regimen) => [regimen.codigo, regimen.id]),
  );
  await transaccion.requisito.createMany({
    data: REQUISITOS.map((requisito) => {
      const tipoDocumentoId = tipos.get(requisito.tipo);
      const regimenId = requisito.regimen === null ? null : regimenes.get(requisito.regimen);
      if (tipoDocumentoId === undefined || regimenId === undefined) {
        throw new Error(`Requisito inválido para el tipo ${requisito.tipo}`);
      }
      return { tipoDocumentoId, regimenId, tipoPersonal: requisito.tipoPersonal, aplicaA: requisito.aplicaA };
    }),
  });
}

async function sembrarOrganizacion(transaccion: Prisma.TransactionClient): Promise<void> {
  if ((await transaccion.area.count({ where: { nombre: SEDE_DIRESA, padreId: null } })) > 0) {
    return;
  }
  const sede = await transaccion.area.create({ data: { nombre: SEDE_DIRESA } });
  await transaccion.area.createMany({ data: UNIDADES_DIRESA.map((nombre) => ({ nombre, padreId: sede.id })) });

  const grupos = new Map<string, number>();
  for (const nombre of [...MICROREDES, SIN_MICRORED]) {
    grupos.set(nombre, (await transaccion.area.create({ data: { nombre, activo: false } })).id);
  }
  await transaccion.area.createMany({
    data: ESTABLECIMIENTOS.map((establecimiento) => {
      const padreId = grupos.get(establecimiento.microred);
      if (padreId === undefined) {
        throw new Error(`El establecimiento ${establecimiento.nombre} no tiene una microred válida`);
      }
      return { nombre: establecimiento.nombre, padreId };
    }),
  });

  await transaccion.cargo.createMany({ data: CARGOS_INSTITUCIONALES.map((nombre) => ({ nombre })), skipDuplicates: true });
  await transaccion.auditoria.create({
    data: {
      accion: 'CATALOGO_CREAR',
      entidad: 'area',
      detalle: {
        origen: 'semilla',
        areas: 1 + UNIDADES_DIRESA.length + grupos.size + ESTABLECIMIENTOS.length,
        cargos: CARGOS_INSTITUCIONALES.length,
      },
    },
  });
}

async function sembrar(): Promise<void> {
  const resultado = esquemaSemilla.safeParse(process.env);
  if (!resultado.success) {
    const campos = resultado.error.issues.map((problema) => problema.path.join('.')).join(', ');
    throw new Error(`Variables de la semilla inválidas: ${campos}`);
  }
  const entorno = resultado.data;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: entorno.DATABASE_URL }) });

  try {
    await prisma.$transaction(async (transaccion) => {
      for (const permiso of PERMISOS) {
        await transaccion.permiso.upsert({
          where: { codigo: permiso.codigo },
          create: permiso,
          update: { modulo: permiso.modulo, descripcion: permiso.descripcion },
        });
      }

      for (const rol of ROLES) {
        const existente = await transaccion.rol.findUnique({ where: { nombre: rol.nombre } });
        if (existente !== null) {
          continue;
        }
        await transaccion.rol.create({
          data: {
            nombre: rol.nombre,
            descripcion: rol.descripcion,
            esSistema: true,
            permisos: { create: rol.permisos.map((permisoCodigo) => ({ permisoCodigo })) },
          },
        });
      }

      if ((await transaccion.usuario.count()) > 0) {
        return;
      }
      const datosAdministrador = esquemaAdministrador.safeParse(entorno);
      if (!datosAdministrador.success) {
        const campos = datosAdministrador.error.issues.map((problema) => problema.path.join('.')).join(', ');
        throw new Error(`Para crear el primer administrador completa en el entorno: ${campos}`);
      }
      const admin = datosAdministrador.data;
      const administrador = await transaccion.rol.findUniqueOrThrow({ where: { nombre: 'Administrador' } });
      const creado = await transaccion.usuario.create({
        data: {
          usuario: admin.ADMIN_USUARIO,
          nombreCompleto: admin.ADMIN_NOMBRE,
          correo: admin.ADMIN_CORREO,
          claveHash: await argon2.hash(admin.ADMIN_CLAVE, { type: argon2.argon2id }),
          rolId: administrador.id,
          debeCambiarClave: false,
        },
      });
      await transaccion.auditoria.create({
        data: { accion: 'USUARIO_CREAR', entidad: 'usuario', entidadId: creado.id, detalle: { origen: 'semilla' } },
      });
    });
    await prisma.$transaction(sembrarCatalogos);
    await prisma.$transaction(sembrarOrganizacion);
  } finally {
    await prisma.$disconnect();
  }
}

sembrar().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido en la semilla'}\n`);
  process.exit(1);
});
