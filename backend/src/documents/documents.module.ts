import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocumentQueueService } from './document-queue.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LegajoController } from './legajo.controller';
import { UploadServerService } from './upload-server.service';

@Module({
  imports: [AuthModule],
  controllers: [LegajoController, DocumentsController],
  providers: [DocumentsService, DocumentQueueService, UploadServerService],
  exports: [UploadServerService, DocumentsService],
})
export class DocumentsModule {}
