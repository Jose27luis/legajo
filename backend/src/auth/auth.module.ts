import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RateLimitService } from './rate-limit.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, RateLimitService, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [SessionService, RateLimitService],
})
export class AuthModule {}
