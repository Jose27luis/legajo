import { Module } from '@nestjs/common';
import { RelativesService } from './relatives.service';
import { WorkerLinksService } from './worker-links.service';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  controllers: [WorkersController],
  providers: [WorkersService, WorkerLinksService, RelativesService],
})
export class WorkersModule {}
