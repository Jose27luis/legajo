import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { DocumentTypeDto, SectionDto } from './dto/catalog.dto';
import { CreateDocumentTypeDto, UpdateDocumentTypeDto } from './dto/catalog-input.dto';
import { DocumentTypesService } from './document-types.service';

@ApiTags('Catálogos')
@Controller('catalogs')
export class SectionsController {
  constructor(private readonly tipos: DocumentTypesService) {}

  @Get('sections')
  @ApiOperation({ summary: 'Las 12 secciones del legajo con sus campos propios y tipos de documento' })
  @ApiResponse({ status: 200, type: [SectionDto] })
  async secciones(): Promise<SectionDto[]> {
    return this.tipos.listarSecciones();
  }

  @Requiere('catalogos.gestionar')
  @Post('document-types')
  @ApiOperation({ summary: 'Crea un tipo de documento con el siguiente código libre de la sección' })
  @ApiResponse({ status: 201, type: DocumentTypeDto })
  async crearTipo(
    @Body() datos: CreateDocumentTypeDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentTypeDto> {
    return this.tipos.crear(datos, sesion, datosCliente(solicitud));
  }

  @Requiere('catalogos.gestionar')
  @Patch('document-types/:id')
  @ApiOperation({ summary: 'Edita un tipo de documento' })
  @ApiResponse({ status: 200, type: DocumentTypeDto })
  @ApiResponse({ status: 404, description: 'El tipo no existe' })
  async editarTipo(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: UpdateDocumentTypeDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentTypeDto> {
    return this.tipos.editar(id, datos, sesion, datosCliente(solicitud));
  }
}
