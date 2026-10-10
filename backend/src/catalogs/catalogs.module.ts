import { Module } from '@nestjs/common';
import { DocumentTypesService } from './document-types.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';
import { SectionsController } from './sections.controller';

@Module({
  controllers: [SectionsController, RequirementsController, OrganizationController],
  providers: [DocumentTypesService, RequirementsService, OrganizationService],
  exports: [DocumentTypesService, OrganizationService],
})
export class CatalogsModule {}
