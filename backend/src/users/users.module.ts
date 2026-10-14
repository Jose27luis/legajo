import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SectionAccessController } from './section-access.controller';
import { SectionAccessService } from './section-access.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, SectionAccessController],
  providers: [UsersService, SectionAccessService],
})
export class UsersModule {}
