import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LaborModule } from '../labor/labor.module';
import { DocumentQueueService } from './document-queue.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DossierService } from './dossier.service';
import { LegajoController } from './legajo.controller';
import { UploadServerService } from './upload-server.service';

@Module({
  imports: [AuthModule, LaborModule],
  controllers: [LegajoController, DocumentsController],
  providers: [DocumentsService, DossierService, DocumentQueueService, UploadServerService],
  exports: [UploadServerService, DocumentsService],
})
export class DocumentsModule {}
