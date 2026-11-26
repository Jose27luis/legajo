import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { BulkDesignationService } from './bulk-designation.service';
import { HeadshipsController } from './headships.controller';
import { HeadshipsService } from './headships.service';

@Module({
  imports: [DocumentsModule],
  controllers: [HeadshipsController],
  providers: [HeadshipsService, BulkDesignationService],
})
export class HeadshipsModule {}
