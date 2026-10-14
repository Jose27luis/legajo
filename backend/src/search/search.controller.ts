import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { QuickSearchDto, SearchQueryDto, SelectionZipDto } from './dto/search-query.dto';
import { QuickResultDto, SearchResultDto } from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('Búsqueda')
@Requiere('personal.ver')
@Controller('search')
export class SearchController {
  constructor(private readonly busqueda: SearchService) {}

  @Get('quick')
  @ApiOperation({ summary: 'Búsqueda rápida de la cabecera' })
  @ApiResponse({ status: 200, type: QuickResultDto })
  async rapida(@Query() consulta: QuickSearchDto, @SesionActual() sesion: SesionActiva): Promise<QuickResultDto> {
    return this.busqueda.rapida(consulta.texto, sesion);
  }

  @Get()
  @ApiOperation({ summary: 'Búsqueda avanzada de trabajadores y documentos' })
  @ApiResponse({ status: 200, type: SearchResultDto })
  async avanzada(@Query() consulta: SearchQueryDto, @SesionActual() sesion: SesionActiva): Promise<SearchResultDto> {
    return this.busqueda.avanzada(consulta, sesion);
  }

  @Get('documents.xlsx')
  @Requiere('personal.ver', 'documentos.ver')
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOperation({ summary: 'Exporta a Excel los documentos que coinciden con la búsqueda' })
  @ApiResponse({ status: 200, description: 'Libro de Excel' })
  async exportarDocumentos(
    @Query() consulta: SearchQueryDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.busqueda.exportarDocumentos(consulta, sesion, datosCliente(solicitud), respuesta);
  }

  @Post('zip')
  @HttpCode(HttpStatus.OK)
  @ApiProduces('application/zip')
  @ApiOperation({ summary: 'Descarga en ZIP los documentos marcados' })
  @ApiResponse({ status: 200, description: 'Archivo ZIP' })
  async zip(
    @Body() datos: SelectionZipDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.busqueda.zip(datos.ids, sesion, datosCliente(solicitud), respuesta);
  }
}
