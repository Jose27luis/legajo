import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { LegajoSectionDto } from '../documents/dto/document.dto';
import { BatchesService } from './batches.service';
import {
  ClassifyItemDto,
  CreateBatchDto,
  DeleteItemDto,
  DiscardItemDto,
  PreviewBatchDto,
  SplitItemDto,
  UploadedItemDto,
} from './dto/batch-input.dto';
import { BatchDetailDto, BatchDto, BatchItemDto, DeleteItemResultDto, PreviewItemDto } from './dto/batch.dto';

const ID = new ParseUUIDPipe({ version: '4' });

@ApiTags('Carga masiva')
@Requiere('carga_masiva.usar')
@Controller('batches')
export class BatchesController {
  constructor(private readonly lotes: BatchesService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Interpreta los nombres de archivo sin subir nada' })
  @ApiResponse({ status: 200, type: [PreviewItemDto] })
  async previsualizar(@Body() datos: PreviewBatchDto, @SesionActual() sesion: SesionActiva): Promise<PreviewItemDto[]> {
    return this.lotes.previsualizar(datos.nombres, sesion);
  }

  @Get('sections')
  @ApiOperation({ summary: 'Secciones con los tipos que la cuenta puede registrar' })
  @ApiResponse({ status: 200, type: [LegajoSectionDto] })
  async secciones(@SesionActual() sesion: SesionActiva): Promise<LegajoSectionDto[]> {
    return this.lotes.secciones(sesion);
  }

  @Get()
  @ApiOperation({ summary: 'Lotes recientes' })
  @ApiResponse({ status: 200, type: [BatchDto] })
  async listar(@SesionActual() sesion: SesionActiva): Promise<BatchDto[]> {
    return this.lotes.listar(sesion);
  }

  @Post()
  @ApiOperation({ summary: 'Crea el lote con la lista de archivos que se van a subir' })
  @ApiResponse({ status: 201, type: BatchDetailDto })
  async crear(@Body() datos: CreateBatchDto, @SesionActual() sesion: SesionActiva, @Req() solicitud: Request): Promise<BatchDetailDto> {
    return this.lotes.crear(datos, sesion, datosCliente(solicitud));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lote con sus archivos' })
  @ApiResponse({ status: 200, type: BatchDetailDto })
  async detalle(@Param('id', ID) id: string, @SesionActual() sesion: SesionActiva): Promise<BatchDetailDto> {
    return this.lotes.detalle(id, sesion);
  }

  @Post(':id/items/:itemId/uploaded')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Avisa que un archivo terminó de subirse y lo clasifica por su nombre' })
  @ApiResponse({ status: 200, type: BatchItemDto })
  async subido(
    @Param('id', ID) id: string,
    @Param('itemId', ID) itemId: string,
    @Body() datos: UploadedItemDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<BatchItemDto> {
    return this.lotes.subido(id, itemId, datos, sesion, datosCliente(solicitud));
  }

  @Get(':id/items/:itemId/file')
  @ApiOperation({ summary: 'Muestra el PDF pendiente de la bandeja' })
  @ApiResponse({ status: 200, description: 'PDF' })
  async archivo(@Param('id', ID) id: string, @Param('itemId', ID) itemId: string, @Res() respuesta: Response): Promise<void> {
    const archivo = await this.lotes.archivo(id, itemId);
    respuesta.setHeader('Content-Type', 'application/pdf');
    respuesta.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`);
    respuesta.setHeader('Cache-Control', 'private, no-store');
    respuesta.setHeader('X-Accel-Redirect', `/internal/uploads/${archivo.ruta}`);
    respuesta.end();
  }

  @Post(':id/items/:itemId/classify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clasifica a mano un archivo pendiente' })
  @ApiResponse({ status: 200, type: BatchItemDto })
  async clasificar(
    @Param('id', ID) id: string,
    @Param('itemId', ID) itemId: string,
    @Body() datos: ClassifyItemDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<BatchItemDto> {
    return this.lotes.clasificar(id, itemId, datos, sesion, datosCliente(solicitud));
  }

  @Post(':id/items/:itemId/split')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Divide un PDF pendiente en varios documentos por rangos de páginas' })
  @ApiResponse({ status: 200, type: BatchItemDto })
  async dividir(
    @Param('id', ID) id: string,
    @Param('itemId', ID) itemId: string,
    @Body() datos: SplitItemDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<BatchItemDto> {
    return this.lotes.dividir(id, itemId, datos, sesion, datosCliente(solicitud));
  }

  @Post(':id/items/:itemId/discard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Descarta un archivo pendiente con motivo' })
  @ApiResponse({ status: 200, type: BatchItemDto })
  async descartar(
    @Param('id', ID) id: string,
    @Param('itemId', ID) itemId: string,
    @Body() datos: DiscardItemDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<BatchItemDto> {
    return this.lotes.descartar(id, itemId, datos, sesion, datosCliente(solicitud));
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Elimina de forma definitiva un archivo que no llegó al legajo; si era el último, elimina el lote',
  })
  @ApiResponse({ status: 200, type: DeleteItemResultDto })
  async eliminar(
    @Param('id', ID) id: string,
    @Param('itemId', ID) itemId: string,
    @Body() datos: DeleteItemDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DeleteItemResultDto> {
    return this.lotes.eliminarItem(id, itemId, datos, sesion, datosCliente(solicitud));
  }
}
