import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ENTORNO, type Entorno } from '../environment/environment';
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

const claveSesion = (sid: string) => `sesion:${sid}`;
const claveSesionesDeUsuario = (usuarioId: string) => `usuario:${usuarioId}:sesiones`;

export type DatosNuevaSesion = Omit<SesionActiva, 'sid' | 'creadaEn'>;

@Injectable()
export class SessionService {
  private readonly duracionSegundos: number;

  constructor(
    private readonly redis: RedisService,
    @Inject(ENTORNO) entorno: Entorno,
  ) {
    this.duracionSegundos = entorno.SESION_MINUTOS * 60;
  }

  async crear(datos: DatosNuevaSesion): Promise<SesionActiva> {
    const sesion: SesionActiva = { ...datos, sid: randomBytes(32).toString('base64url'), creadaEn: new Date().toISOString() };
    await this.redis.cliente
      .multi()
      .set(claveSesion(sesion.sid), JSON.stringify(sesion), 'EX', this.duracionSegundos)
      .sadd(claveSesionesDeUsuario(sesion.usuarioId), sesion.sid)
      .expire(claveSesionesDeUsuario(sesion.usuarioId), DURACION_INDICE_SEGUNDOS)
      .exec();
    return sesion;
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
    return resultado.data;
  }

  async actualizar(sesion: SesionActiva): Promise<void> {
    await this.redis.cliente.set(claveSesion(sesion.sid), JSON.stringify(sesion), 'EX', this.duracionSegundos);
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
}
