import { Module } from '@nestjs/common';
import { EnvironmentModule } from './environment/environment.module';
import { PrismaModule } from './prisma/prisma.module';
import { DocumentProcessorService } from './documents/document-processor.service';
import { BackupRunnerService } from './backups/backup-runner.service';
import { AuditService } from './audit/audit.service';
import { ContractExpiryRunnerService } from './labor/contract-expiry-runner.service';
import { ContractExpiryService } from './labor/contract-expiry.service';

@Module({
  imports: [EnvironmentModule, PrismaModule],
  providers: [DocumentProcessorService, BackupRunnerService, AuditService, ContractExpiryService, ContractExpiryRunnerService],
})
export class WorkerModule {}
