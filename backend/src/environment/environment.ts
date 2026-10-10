import { z } from 'zod';

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['production', 'development']).default('production'),
  PUERTO: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  SESION_MINUTOS: z.coerce.number().int().min(5).max(480).default(30),
  COOKIE_SEGURA: z.enum(['true', 'false']).default('true').transform((valor) => valor === 'true'),
  DIR_SUBIDAS: z.string().startsWith('/').default('/data/subidas'),
  DIR_ARCHIVOS: z.string().startsWith('/').default('/data/archivos'),
  TAMANO_MAXIMO_MB: z.coerce.number().int().min(1).max(1024).default(200),
  OPTIMIZAR_PPP: z.coerce.number().int().min(72).max(600).default(150),
  OPTIMIZAR_GRISES: z.enum(['true', 'false']).default('false').transform((valor) => valor === 'true'),
  WORKER_CONCURRENCIA: z.coerce.number().int().min(1).max(16).default(2),
});

export type Entorno = z.infer<typeof esquemaEntorno>;

export const ENTORNO = Symbol('ENTORNO');

export function cargarEntorno(fuente: NodeJS.ProcessEnv): Entorno {
  const resultado = esquemaEntorno.safeParse(fuente);
  if (!resultado.success) {
    const campos = resultado.error.issues.map((problema) => problema.path.join('.')).join(', ');
    throw new Error(`Variables de entorno inválidas: ${campos}`);
  }
  return resultado.data;
}
