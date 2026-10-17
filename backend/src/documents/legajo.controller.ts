import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { CreateDocumentDto } from './dto/document-input.dto';
import { DocumentDto, LegajoDto } from './dto/document.dto';
import { DocumentsService } from './documents.service';
import { DossierService } from './dossier.service';

const ID = new ParseUUIDPipe({ version: '4' });

function leerSecciones(valor: string | undefined): number[] | null {
  if (valor === undefined || valor.trim() === '') {
    return null;
  }
  const numeros = valor.split(',').map((parte) => Number(parte.trim()));
  if (numeros.some((numero) => !Number.isInteger(numero) || numero < 1 || numero > 12)) {
    throw new BadRequestException('Las secciones deben ser números del 1 al 12');
  }
  return [...new Set(numeros)];
}

@ApiTags('Legajo')
@Controller('workers/:id')
export class LegajoController {
  constructor(
    private readonly documentos: DocumentsService,
    private readonly expedientes: DossierService,
  ) {}

  @Requiere('documentos.descargar')
  @Get('dossier.pdf')
  @ApiProduces('application/pdf')
  @ApiQuery({ name: 'sections', required: false, description: 'Números de sección separados por coma' })
  @ApiQuery({ name: 'cover', required: false, enum: ['1', '0'], description: 'Incluir portada e índice' })
  @ApiOperation({ summary: 'Une en un solo PDF los documentos registrados de las secciones elegidas' })
  @ApiResponse({ status: 200, description: 'Expediente en PDF' })
  async expediente(
    @Param('id', ID) id: string,
    @Query('sections') secciones: string | undefined,
    @Query('cover') portada: string | undefined,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.expedientes.pdf(id, leerSecciones(secciones), portada !== '0', sesion, datosCliente(solicitud), respuesta);
  }

  @Requiere('documentos.ver')
  @Get('dossier-index.xlsx')
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiQuery({ name: 'sections', required: false, description: 'Números de sección separados por coma' })
  @ApiOperation({ summary: 'Índice del legajo en Excel con los documentos de las secciones elegidas' })
  @ApiResponse({ status: 200, description: 'Archivo de Excel' })
  async indice(
    @Param('id', ID) id: string,
    @Query('sections') secciones: string | undefined,
    @SesionActual() sesion: SesionActiva,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.expedientes.indice(id, leerSecciones(secciones), sesion, respuesta);
  }

  @Requiere('personal.ver', 'documentos.ver')
  @Get('legajo')
  @ApiOperation({ summary: 'Secciones del legajo con los documentos que el rol puede ver' })
  @ApiResponse({ status: 200, type: LegajoDto })
  async legajo(@Param('id', ID) id: string, @SesionActual() sesion: SesionActiva): Promise<LegajoDto> {
    return this.documentos.legajo(id, sesion);
  }

  @Requiere('documentos.subir')
  @Post('documents')
  @ApiOperation({ summary: 'Registra un documento con una subida tus completada y lo envía a procesar' })
  @ApiResponse({ status: 201, type: DocumentDto })
  async registrar(
    @Param('id', ID) id: string,
    @Body() datos: CreateDocumentDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentDto> {
    return this.documentos.registrar(id, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('documentos.descargar')
  @Get('zip')
  @ApiProduces('application/zip')
  @ApiQuery({ name: 'sections', required: false, description: 'Números de sección separados por coma' })
  @ApiOperation({ summary: 'Descarga en ZIP el legajo completo o las secciones indicadas' })
  @ApiResponse({ status: 200, description: 'Archivo ZIP' })
  async zip(
    @Param('id', ID) id: string,
    @Query('sections') secciones: string | undefined,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.documentos.zip(id, leerSecciones(secciones), sesion, datosCliente(solicitud), respuesta);
  }
}
