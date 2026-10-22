import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GRADOS_INSTRUCCION, type GradoInstruccion } from '../education-catalog';
import { EducationLevelDto } from './dto/education.dto';

@ApiTags('Catálogos')
@Controller('catalogs')
export class EducationController {
  @Get('education')
  @ApiOperation({ summary: 'Grados de instrucción con sus profesiones y condiciones de la profesión' })
  @ApiResponse({ status: 200, type: [EducationLevelDto] })
  formacion(): readonly GradoInstruccion[] {
    return GRADOS_INSTRUCCION;
  }
}
