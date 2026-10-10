import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { RequirementDto } from './dto/catalog.dto';
import { CreateRequirementDto } from './dto/catalog-input.dto';
import { RequirementsService } from './requirements.service';

@ApiTags('Catálogos')
@Controller('catalogs/requirements')
export class RequirementsController {
  constructor(private readonly requisitos: RequirementsService) {}

  @Get()
  @ApiOperation({ summary: 'Documentos obligatorios por régimen, tipo de personal y estado' })
  @ApiResponse({ status: 200, type: [RequirementDto] })
  async listar(): Promise<RequirementDto[]> {
    return this.requisitos.listar();
  }

  @Requiere('catalogos.gestionar')
  @Post()
  @ApiOperation({ summary: 'Agrega un documento obligatorio' })
  @ApiResponse({ status: 201, type: RequirementDto })
  @ApiResponse({ status: 409, description: 'Ya existe con las mismas condiciones' })
  async crear(
    @Body() datos: CreateRequirementDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<RequirementDto> {
    return this.requisitos.crear(datos, sesion, datosCliente(solicitud));
  }

  @Requiere('catalogos.gestionar')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quita un documento obligatorio' })
  @ApiResponse({ status: 204, description: 'Quitado' })
  @ApiResponse({ status: 404, description: 'No existe' })
  async quitar(
    @Param('id', ParseIntPipe) id: number,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<void> {
    await this.requisitos.quitar(id, sesion, datosCliente(solicitud));
  }
}
