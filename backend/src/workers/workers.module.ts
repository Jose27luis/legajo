import { Module } from '@nestjs/common';
import { LaborModule } from '../labor/labor.module';
import { RelativesService } from './relatives.service';
import { WorkerImportController } from './worker-import.controller';
import { WorkerImportService } from './worker-import.service';
import { WorkerLinksService } from './worker-links.service';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [LaborModule],
  controllers: [WorkerImportController, WorkersController],
  providers: [WorkersService, WorkerLinksService, RelativesService, WorkerImportService],
})
export class WorkersModule {}
