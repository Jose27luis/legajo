import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { BulkDesignationService } from './bulk-designation.service';
import { BulkDesignationDto, CandidatesQueryDto, RegisterBulkDesignationDto } from './dto/bulk-designation-input.dto';
import { BulkResultDto, BulkReviewDto, HeadshipCandidateDto, HeadshipsDto } from './dto/headship.dto';
import { HeadshipsService } from './headships.service';

@ApiTags('Jefaturas')
@Controller('headships')
export class HeadshipsController {
  constructor(
    private readonly jefaturas: HeadshipsService,
    private readonly masivo: BulkDesignationService,
  ) {}

  @Requiere('personal.ver')
  @Get()
  @ApiOperation({ summary: 'Jefes de EESS y gerentes de microred: vigente e historial de cada sede según las designaciones 0704' })
  @ApiResponse({ status: 200, type: HeadshipsDto })
  async listar(@SesionActual() sesion: SesionActiva): Promise<HeadshipsDto> {
    return this.jefaturas.listar(sesion);
  }

  @Requiere('personal.ver')
  @Get('candidates')
  @ApiOperation({ summary: 'Personal activo que se puede designar en un EESS (su período actual) o en una microred (en alguno de sus EESS)' })
  @ApiResponse({ status: 200, type: [HeadshipCandidateDto] })
  @ApiResponse({ status: 404, description: 'El área no es un EESS ni una microred' })
  async candidatos(@Query() consulta: CandidatesQueryDto): Promise<HeadshipCandidateDto[]> {
    return this.masivo.candidatos(consulta.areaId);
  }

  @Requiere('personal.ver', 'documentos.subir')
  @Post('bulk/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revisa todas las designaciones de una resolución sin guardar nada' })
  @ApiResponse({ status: 200, type: BulkReviewDto })
  async revisar(@Body() datos: BulkDesignationDto, @SesionActual() sesion: SesionActiva): Promise<BulkReviewDto> {
    return this.masivo.revisar(datos, sesion);
  }

  @Requiere('personal.ver', 'documentos.subir')
  @Post('bulk')
  @ApiOperation({ summary: 'Registra una designación 0704 por persona con una copia del PDF de la resolución; todo o nada' })
  @ApiResponse({ status: 201, type: BulkResultDto })
  @ApiResponse({ status: 400, description: 'Alguna fila no es válida: no se registra ninguna' })
  async registrar(
    @Body() datos: RegisterBulkDesignationDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<BulkResultDto> {
    return this.masivo.registrar(datos, sesion, datosCliente(solicitud));
  }
}
