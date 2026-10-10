import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ENTORNO, type Entorno } from './environment/environment';
import { UploadServerService } from './documents/upload-server.service';

const RUTA_SUBIDAS = '/api/uploads';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  const entorno = app.get<Entorno>(ENTORNO);

  const subidas = app.get(UploadServerService);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use((solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    if (solicitud.path !== RUTA_SUBIDAS && !solicitud.path.startsWith(`${RUTA_SUBIDAS}/`)) {
      siguiente();
      return;
    }
    subidas.servidor.handle(solicitud, respuesta).catch((error: unknown) => siguiente(error));
  });
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );
  app.enableShutdownHooks();

  if (entorno.NODE_ENV !== 'production') {
    const configuracion = new DocumentBuilder().setTitle('Legajos de Personal').setVersion('0.1.0').build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, configuracion));
  }

  await app.listen(entorno.PUERTO, '0.0.0.0');
  Logger.log(`API escuchando en el puerto ${entorno.PUERTO}`, 'Inicio');
}

void iniciar();
