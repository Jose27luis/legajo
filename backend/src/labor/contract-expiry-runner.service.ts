import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { conexionRedis } from '../documents/document-queue';
import { ENTORNO, type Entorno } from '../environment/environment';
import { ContractExpiryService } from './contract-expiry.service';

const COLA_CONTRATOS = 'contratos';
const TRABAJO_VENCER = 'vencer-contratos';
const PREFIJO_COLAS = 'legajos-colas';

@Injectable()
export class ContractExpiryRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly bitacora = new Logger(ContractExpiryRunnerService.name);
  private programador?: Queue;
  private trabajador?: Worker;

  constructor(
    private readonly vencimientos: ContractExpiryService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async onModuleInit(): Promise<void> {
    const conexion = conexionRedis(this.entorno.REDIS_URL);
    this.programador = new Queue(COLA_CONTRATOS, { connection: conexion, prefix: PREFIJO_COLAS });
    await this.programador.upsertJobScheduler(
      TRABAJO_VENCER,
      { pattern: '5 0 * * *', tz: 'America/Lima' },
      { name: TRABAJO_VENCER, opts: { removeOnComplete: 30, removeOnFail: 30 } },
    );
    this.trabajador = new Worker(COLA_CONTRATOS, () => this.vencimientos.vencerTodos().then(() => undefined), {
      connection: conexion,
      prefix: PREFIJO_COLAS,
      concurrency: 1,
    });
    this.trabajador.on('failed', (_trabajo, error) => this.bitacora.error(`Revisión de contratos vencidos falló: ${error.message}`));
    await this.vencimientos.vencerTodos();
  }

  async onModuleDestroy(): Promise<void> {
    await this.trabajador?.close();
    await this.programador?.close();
  }
}
