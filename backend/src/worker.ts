import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function iniciar(): Promise<void> {
  const contexto = await NestFactory.createApplicationContext(WorkerModule, { logger: ['error', 'warn', 'log'] });
  contexto.enableShutdownHooks();
  Logger.log('Worker de documentos en marcha', 'Inicio');
}

void iniciar();
