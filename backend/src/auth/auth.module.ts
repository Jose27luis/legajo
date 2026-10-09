import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LimiteService } from './limite.service';
import { SesionGuard } from './sesion.guard';
import { SesionService } from './sesion.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SesionService, LimiteService, { provide: APP_GUARD, useClass: SesionGuard }],
  exports: [SesionService, LimiteService],
})
export class AuthModule {}
