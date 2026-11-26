import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { HeadshipsDto } from './dto/headship.dto';
import { HeadshipsService } from './headships.service';

@ApiTags('Jefaturas')
@Controller('headships')
export class HeadshipsController {
  constructor(private readonly jefaturas: HeadshipsService) {}

  @Requiere('personal.ver')
  @Get()
  @ApiOperation({ summary: 'Jefes de EESS y gerentes de microred: vigente e historial de cada sede según las designaciones 0704' })
  @ApiResponse({ status: 200, type: HeadshipsDto })
  async listar(@SesionActual() sesion: SesionActiva): Promise<HeadshipsDto> {
    return this.jefaturas.listar(sesion);
  }
}
