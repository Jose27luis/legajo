import { Module } from '@nestjs/common';
import { EnvironmentModule } from './environment/environment.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { WorkersModule } from './workers/workers.module';
import { DocumentsModule } from './documents/documents.module';
import { BatchesModule } from './batches/batches.module';
import { SearchModule } from './search/search.module';
import { ReportsModule } from './reports/reports.module';
import { BackupsModule } from './backups/backups.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    EnvironmentModule,
    PrismaModule,
    RedisModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CatalogsModule,
    WorkersModule,
    DocumentsModule,
    BatchesModule,
    SearchModule,
    ReportsModule,
    BackupsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
