import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENTORNO, type Entorno } from '../environment/environment';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly cliente: Redis;

  constructor(@Inject(ENTORNO) entorno: Entorno) {
    this.cliente = new Redis(entorno.REDIS_URL, { keyPrefix: 'legajos:', maxRetriesPerRequest: 3 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.cliente.quit();
  }
}
