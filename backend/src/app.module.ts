import { Module } from '@nestjs/common';
import { EntornoModule } from './entorno/entorno.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { SaludController } from './salud/salud.controller';

@Module({
  imports: [EntornoModule, PrismaModule, RedisModule, AuditoriaModule, AuthModule],
  controllers: [SaludController],
})
export class AppModule {}
