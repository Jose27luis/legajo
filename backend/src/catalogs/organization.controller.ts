import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { AreaDto, PositionDto, RegimeDto } from './dto/catalog.dto';
import { AreaInputDto, CreateRegimeDto, PositionInputDto, UpdateRegimeDto } from './dto/catalog-input.dto';
import { OrganizationService } from './organization.service';

@ApiTags('Catálogos')
@Controller('catalogs')
export class OrganizationController {
  constructor(private readonly organizacion: OrganizationService) {}

  @Get('regimes')
  @ApiOperation({ summary: 'Regímenes laborales' })
  @ApiResponse({ status: 200, type: [RegimeDto] })
  async regimenes(): Promise<RegimeDto[]> {
    return this.organizacion.listarRegimenes();
  }

  @Requiere('catalogos.gestionar')
  @Post('regimes')
  @ApiOperation({ summary: 'Crea un régimen' })
  @ApiResponse({ status: 201, type: RegimeDto })
  async crearRegimen(
    @Body() datos: CreateRegimeDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<RegimeDto> {
    return this.organizacion.crearRegimen(datos, sesion, datosCliente(solicitud));
  }

  @Requiere('catalogos.gestionar')
  @Patch('regimes/:id')
  @ApiOperation({ summary: 'Edita un régimen' })
  @ApiResponse({ status: 200, type: RegimeDto })
  async editarRegimen(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: UpdateRegimeDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<RegimeDto> {
    return this.organizacion.editarRegimen(id, datos, sesion, datosCliente(solicitud));
  }

  @Get('areas')
  @ApiOperation({ summary: 'Áreas o dependencias' })
  @ApiResponse({ status: 200, type: [AreaDto] })
  async areas(): Promise<AreaDto[]> {
    return this.organizacion.listarAreas();
  }

  @Requiere('catalogos.gestionar')
  @Post('areas')
  @ApiOperation({ summary: 'Crea un área' })
  @ApiResponse({ status: 201, type: AreaDto })
  async crearArea(
    @Body() datos: AreaInputDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<AreaDto> {
    return this.organizacion.crearArea(datos, sesion, datosCliente(solicitud));
  }

  @Requiere('catalogos.gestionar')
  @Patch('areas/:id')
  @ApiOperation({ summary: 'Edita un área' })
  @ApiResponse({ status: 200, type: AreaDto })
  async editarArea(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: AreaInputDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<AreaDto> {
    return this.organizacion.editarArea(id, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('catalogos.gestionar')
  @Delete('areas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un área que no esté en uso' })
  @ApiResponse({ status: 204, description: 'Área eliminada' })
  @ApiResponse({ status: 409, description: 'El área está en uso; se puede desactivar' })
  async eliminarArea(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: SesionActiva, @Req() solicitud: Request): Promise<void> {
    await this.organizacion.eliminarArea(id, sesion, datosCliente(solicitud));
  }

  @Get('positions')
  @ApiOperation({ summary: 'Cargos' })
  @ApiResponse({ status: 200, type: [PositionDto] })
  async cargos(): Promise<PositionDto[]> {
    return this.organizacion.listarCargos();
  }

  @Requiere('catalogos.gestionar')
  @Post('positions')
  @ApiOperation({ summary: 'Crea un cargo' })
  @ApiResponse({ status: 201, type: PositionDto })
  async crearCargo(
    @Body() datos: PositionInputDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<PositionDto> {
    return this.organizacion.crearCargo(datos, sesion, datosCliente(solicitud));
  }

  @Requiere('catalogos.gestionar')
  @Patch('positions/:id')
  @ApiOperation({ summary: 'Edita un cargo' })
  @ApiResponse({ status: 200, type: PositionDto })
  async editarCargo(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: PositionInputDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<PositionDto> {
    return this.organizacion.editarCargo(id, datos, sesion, datosCliente(solicitud));
  }
}
