import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ENTORNO, type Entorno } from '../environment/environment';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { SesionActiva } from '../common/session';

const esquemaSesion = z.object({
  sid: z.string(),
  usuarioId: z.uuid(),
  rol: z.string(),
  permisos: z.array(z.string()),
  debeCambiarClave: z.boolean(),
  creadaEn: z.string(),
});

const FORMATO_SID = /^[A-Za-z0-9_-]{43}$/;
const DURACION_INDICE_SEGUNDOS = 7 * 24 * 60 * 60;
const DURACION_RESTRICCIONES_SEGUNDOS = 5 * 60;
const CLAVE_RESTRICCIONES = 'secciones-restringidas';

const claveSesion = (sid: string) => `sesion:${sid}`;
const claveSesionesDeUsuario = (usuarioId: string) => `usuario:${usuarioId}:sesiones`;

export type DatosNuevaSesion = Omit<SesionActiva, 'sid' | 'creadaEn' | 'seccionesRestringidas'>;

type SesionGuardada = z.infer<typeof esquemaSesion>;

@Injectable()
export class SessionService {
  private readonly duracionSegundos: number;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    @Inject(ENTORNO) entorno: Entorno,
  ) {
    this.duracionSegundos = entorno.SESION_MINUTOS * 60;
  }

  async crear(datos: DatosNuevaSesion): Promise<SesionActiva> {
    const guardada: SesionGuardada = { ...datos, sid: randomBytes(32).toString('base64url'), creadaEn: new Date().toISOString() };
    await this.redis.cliente
      .multi()
      .set(claveSesion(guardada.sid), JSON.stringify(guardada), 'EX', this.duracionSegundos)
      .sadd(claveSesionesDeUsuario(guardada.usuarioId), guardada.sid)
      .expire(claveSesionesDeUsuario(guardada.usuarioId), DURACION_INDICE_SEGUNDOS)
      .exec();
    return { ...guardada, seccionesRestringidas: await this.seccionesRestringidas(guardada.rol) };
  }

  async obtener(sid: string): Promise<SesionActiva | null> {
    if (!FORMATO_SID.test(sid)) {
      return null;
    }
    const texto = await this.redis.cliente.getex(claveSesion(sid), 'EX', this.duracionSegundos);
    if (texto === null) {
      return null;
    }
    const contenido: unknown = JSON.parse(texto);
    const resultado = esquemaSesion.safeParse(contenido);
    if (!resultado.success || resultado.data.sid !== sid) {
      await this.redis.cliente.del(claveSesion(sid));
      return null;
    }
    return { ...resultado.data, seccionesRestringidas: await this.seccionesRestringidas(resultado.data.rol) };
  }

  async actualizar(sesion: SesionActiva): Promise<void> {
    const guardada: SesionGuardada = {
      sid: sesion.sid,
      usuarioId: sesion.usuarioId,
      rol: sesion.rol,
      permisos: sesion.permisos,
      debeCambiarClave: sesion.debeCambiarClave,
      creadaEn: sesion.creadaEn,
    };
    await this.redis.cliente.set(claveSesion(sesion.sid), JSON.stringify(guardada), 'EX', this.duracionSegundos);
  }

  async cerrar(sesion: SesionActiva): Promise<void> {
    await this.redis.cliente
      .multi()
      .del(claveSesion(sesion.sid))
      .srem(claveSesionesDeUsuario(sesion.usuarioId), sesion.sid)
      .exec();
  }

  async cerrarTodasDeUsuario(usuarioId: string, sidQueSeConserva?: string): Promise<void> {
    const indice = claveSesionesDeUsuario(usuarioId);
    const sids = await this.redis.cliente.smembers(indice);
    const aCerrar = sids.filter((sid) => sid !== sidQueSeConserva);
    if (aCerrar.length === 0) {
      return;
    }
    await this.redis.cliente
      .multi()
      .del(...aCerrar.map(claveSesion))
      .srem(indice, ...aCerrar)
      .exec();
  }

  async olvidarRestricciones(): Promise<void> {
    await this.redis.cliente.del(CLAVE_RESTRICCIONES);
  }

  private async seccionesRestringidas(rol: string): Promise<number[]> {
    const guardado = await this.redis.cliente.hget(CLAVE_RESTRICCIONES, rol);
    if (guardado !== null) {
      const lectura = z.array(z.number().int()).safeParse(JSON.parse(guardado));
      if (lectura.success) {
        return lectura.data;
      }
    }
    const filas = await this.prisma.rolSeccionRestringida.findMany({
      where: { rol: { nombre: rol } },
      select: { seccion: { select: { numero: true } } },
    });
    const numeros = filas.map((fila) => fila.seccion.numero).sort((a, b) => a - b);
    await this.redis.cliente
      .multi()
      .hset(CLAVE_RESTRICCIONES, rol, JSON.stringify(numeros))
      .expire(CLAVE_RESTRICCIONES, DURACION_RESTRICCIONES_SEGUNDOS)
      .exec();
    return numeros;
  }
}
