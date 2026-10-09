import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LimiteService {
  constructor(private readonly redis: RedisService) {}

  async consumir(clave: string, maximo: number, ventanaSegundos: number): Promise<boolean> {
    const claveCompleta = `limite:${clave}`;
    const resultado = await this.redis.cliente
      .multi()
      .incr(claveCompleta)
      .expire(claveCompleta, ventanaSegundos, 'NX')
      .exec();
    const cuenta = resultado?.[0]?.[1];
    if (typeof cuenta !== 'number') {
      throw new Error('No se pudo registrar el intento en Redis');
    }
    return cuenta <= maximo;
  }
}
