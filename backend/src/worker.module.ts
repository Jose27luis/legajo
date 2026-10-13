import { Module } from '@nestjs/common';
import { EnvironmentModule } from './environment/environment.module';
import { PrismaModule } from './prisma/prisma.module';
import { DocumentProcessorService } from './documents/document-processor.service';
import { BackupRunnerService } from './backups/backup-runner.service';

@Module({
  imports: [EnvironmentModule, PrismaModule],
  providers: [DocumentProcessorService, BackupRunnerService],
})
export class WorkerModule {}
