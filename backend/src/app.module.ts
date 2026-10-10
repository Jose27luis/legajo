import { Module } from '@nestjs/common';
import { EnvironmentModule } from './environment/environment.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [EnvironmentModule, PrismaModule, RedisModule, AuditModule, AuthModule, UsersModule, CatalogsModule],
  controllers: [HealthController],
})
export class AppModule {}
