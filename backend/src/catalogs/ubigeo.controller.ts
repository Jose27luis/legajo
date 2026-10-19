import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UBIGEO_PERU, type DepartamentoUbigeo } from '../ubigeo-catalog';
import { UbigeoDepartmentDto } from './dto/ubigeo.dto';

@ApiTags('Catálogos')
@Controller('catalogs')
export class UbigeoController {
  @Get('ubigeo')
  @ApiOperation({ summary: 'Departamentos, provincias y distritos del Perú (INEI)' })
  @ApiResponse({ status: 200, type: [UbigeoDepartmentDto] })
  ubigeo(): readonly DepartamentoUbigeo[] {
    return UBIGEO_PERU;
  }
}
