import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ENTORNO, type Entorno } from '../environment/environment';
import {
  COLA_DOCUMENTOS,
  TRABAJO_ELIMINAR,
  TRABAJO_PROCESAR,
  conexionRedis,
  type TrabajoDocumentos,
  type TrabajoEliminar,
  type TrabajoProcesar,
} from './document-queue';

@Injectable()
export class DocumentQueueService implements OnModuleDestroy {
  private readonly cola: Queue<TrabajoDocumentos>;

  constructor(@Inject(ENTORNO) entorno: Entorno) {
    this.cola = new Queue<TrabajoDocumentos>(COLA_DOCUMENTOS, {
      connection: conexionRedis(entorno.REDIS_URL),
      prefix: 'legajos-colas',
    });
  }

  async encolar(trabajo: TrabajoProcesar): Promise<void> {
    await this.cola.add(TRABAJO_PROCESAR, trabajo, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    });
  }

  async eliminarArchivos(trabajo: TrabajoEliminar): Promise<void> {
    await this.cola.add(TRABAJO_ELIMINAR, trabajo, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.cola.close();
  }
}
