import { Module } from '@nestjs/common';
import { EnvironmentModule } from './environment/environment.module';
import { PrismaModule } from './prisma/prisma.module';
import { DocumentProcessorService } from './documents/document-processor.service';

@Module({
  imports: [EnvironmentModule, PrismaModule],
  providers: [DocumentProcessorService],
})
export class WorkerModule {}
