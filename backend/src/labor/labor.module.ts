import { Module } from '@nestjs/common';
import { LaborController } from './labor.controller';
import { LaborService } from './labor.service';
import { ContractExpiryService } from './contract-expiry.service';

@Module({
  controllers: [LaborController],
  providers: [LaborService, ContractExpiryService],
  exports: [LaborService],
})
export class LaborModule {}
