import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';

@Module({
  imports: [DocumentsModule],
  controllers: [BatchesController],
  providers: [BatchesService],
})
export class BatchesModule {}
