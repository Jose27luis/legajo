import { z } from 'zod';

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['production', 'development']).default('production'),
  PUERTO: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  SESION_MINUTOS: z.coerce.number().int().min(5).max(480).default(30),
  COOKIE_SEGURA: z.enum(['true', 'false']).default('true').transform((valor) => valor === 'true'),
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
