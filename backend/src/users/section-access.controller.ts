import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { RoleSectionAccessDto, SectionAccessDto, UpdateSectionAccessDto } from './dto/section-access.dto';
import { SectionAccessService } from './section-access.service';

const ID = new ParseUUIDPipe({ version: '4' });

@ApiTags('Usuarios')
@Requiere('usuarios.gestionar')
@Controller('section-access')
export class SectionAccessController {
  constructor(private readonly permisos: SectionAccessService) {}

  @Get()
  @ApiOperation({ summary: 'Secciones que cada rol puede consultar' })
  @ApiResponse({ status: 200, type: SectionAccessDto })
  async listar(): Promise<SectionAccessDto> {
    return this.permisos.listar();
  }

  @Put(':rolId')
  @ApiOperation({ summary: 'Define las secciones restringidas de un rol; se aplica de inmediato' })
  @ApiResponse({ status: 200, type: RoleSectionAccessDto })
  async actualizar(
    @Param('rolId', ID) rolId: string,
    @Body() datos: UpdateSectionAccessDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<RoleSectionAccessDto> {
    return this.permisos.actualizar(rolId, datos.restringidas, sesion, datosCliente(solicitud));
  }
}
