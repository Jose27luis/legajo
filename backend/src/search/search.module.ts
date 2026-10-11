import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [DocumentsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
