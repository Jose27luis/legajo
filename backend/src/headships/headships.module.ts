import { Module } from '@nestjs/common';
import { HeadshipsController } from './headships.controller';
import { HeadshipsService } from './headships.service';

@Module({
  controllers: [HeadshipsController],
  providers: [HeadshipsService],
})
export class HeadshipsModule {}
