import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { ReplaceDocumentDto, UpdateDocumentDto, VoidDocumentDto } from './dto/document-input.dto';
import { DocumentDto, DocumentHistoryEntryDto } from './dto/document.dto';
import { DocumentsService } from './documents.service';

const ID = new ParseUUIDPipe({ version: '4' });

@ApiTags('Documentos')
@Controller('documents/:id')
export class DocumentsController {
  constructor(private readonly documentos: DocumentsService) {}

  @Requiere('documentos.editar')
  @Patch()
  @ApiOperation({ summary: 'Corrige los datos o reclasifica dentro de la sección; exige motivo' })
  @ApiResponse({ status: 200, type: DocumentDto })
  async editar(
    @Param('id', ID) id: string,
    @Body() datos: UpdateDocumentDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentDto> {
    return this.documentos.editar(id, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('documentos.anular')
  @Post('void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anula el documento con motivo; se conserva en el legajo' })
  @ApiResponse({ status: 200, type: DocumentDto })
  async anular(
    @Param('id', ID) id: string,
    @Body() datos: VoidDocumentDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentDto> {
    return this.documentos.anular(id, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('documentos.editar')
  @Post('replace')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reemplaza el PDF del mismo documento por una versión nueva' })
  @ApiResponse({ status: 200, type: DocumentDto })
  async reemplazar(
    @Param('id', ID) id: string,
    @Body() datos: ReplaceDocumentDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentDto> {
    return this.documentos.reemplazar(id, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('documentos.subir')
  @Post('retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reintenta un procesamiento que falló por un problema técnico' })
  @ApiResponse({ status: 200, type: DocumentDto })
  async reintentar(
    @Param('id', ID) id: string,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentDto> {
    return this.documentos.reintentar(id, sesion, datosCliente(solicitud));
  }

  @Requiere('documentos.ver')
  @Get('history')
  @ApiOperation({ summary: 'Cambios del documento: registro, correcciones, reemplazos, anulación y confirmaciones' })
  @ApiResponse({ status: 200, type: [DocumentHistoryEntryDto] })
  async historial(@Param('id', ID) id: string, @SesionActual() sesion: SesionActiva): Promise<DocumentHistoryEntryDto[]> {
    return this.documentos.historial(id, sesion);
  }

  @Requiere('documentos.ver')
  @Get('file')
  @ApiQuery({ name: 'download', required: false, enum: ['1'] })
  @ApiOperation({ summary: 'Entrega el PDF por nginx (en línea o como descarga)' })
  @ApiResponse({ status: 200, description: 'PDF' })
  async archivo(
    @Param('id', ID) id: string,
    @Query('download') descargar: string | undefined,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    const descarga = descargar === '1';
    const archivo = await this.documentos.archivo(id, descarga, sesion, datosCliente(solicitud));
    const nombre = encodeURIComponent(archivo.nombre);
    respuesta.setHeader('Content-Type', 'application/pdf');
    respuesta.setHeader(
      'Content-Disposition',
      `${descarga ? 'attachment' : 'inline'}; filename="${archivo.nombre}"; filename*=UTF-8''${nombre}`,
    );
    respuesta.setHeader('Cache-Control', 'private, no-store');
    respuesta.setHeader('X-Accel-Redirect', `/internal/files/${archivo.ruta}`);
    respuesta.end();
  }
}
