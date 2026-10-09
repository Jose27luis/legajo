import { Global, Module } from '@nestjs/common';
import { ENTORNO, cargarEntorno } from './environment';

@Global()
@Module({
  providers: [{ provide: ENTORNO, useFactory: () => cargarEntorno(process.env) }],
  exports: [ENTORNO],
})
export class EnvironmentModule {}
