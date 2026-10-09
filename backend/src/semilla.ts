import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { PrismaClient } from './generated/prisma/client';

const esquemaSemilla = z.object({
  DATABASE_URL: z.url(),
  ADMIN_USUARIO: z.string().regex(/^[a-z0-9._-]{4,30}$/),
  ADMIN_NOMBRE: z.string().trim().min(1).max(120),
  ADMIN_CORREO: z.email().transform((correo) => correo.toLowerCase()),
  ADMIN_CLAVE: z.string().min(10).max(100),
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

      const administrador = await transaccion.rol.findUniqueOrThrow({ where: { nombre: 'Administrador' } });
      const existe = await transaccion.usuario.findFirst({
        where: { OR: [{ correo: entorno.ADMIN_CORREO }, { usuario: entorno.ADMIN_USUARIO }] },
      });
      if (existe !== null) {
        return;
      }
      const creado = await transaccion.usuario.create({
        data: {
          usuario: entorno.ADMIN_USUARIO,
          nombreCompleto: entorno.ADMIN_NOMBRE,
          correo: entorno.ADMIN_CORREO,
          claveHash: await argon2.hash(entorno.ADMIN_CLAVE, { type: argon2.argon2id }),
          rolId: administrador.id,
          debeCambiarClave: false,
        },
      });
      await transaccion.auditoria.create({
        data: { accion: 'USUARIO_CREAR', entidad: 'usuario', entidadId: creado.id, detalle: { origen: 'semilla' } },
      });
    });
  } finally {
    await prisma.$disconnect();
  }
}

sembrar().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido en la semilla'}\n`);
  process.exit(1);
});
