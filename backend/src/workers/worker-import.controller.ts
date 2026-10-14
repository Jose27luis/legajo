import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { ImportCommitDto, ImportPreviewDto, ImportResultDto } from './dto/worker-import.dto';
import { WorkerImportService } from './worker-import.service';

const TAMANO_MAXIMO = 5 * 1024 * 1024;

@ApiTags('Personal')
@Requiere('personal.editar')
@Controller('workers/import')
export class WorkerImportController {
  constructor(private readonly importacion: WorkerImportService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { archivo: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Lee un CSV o Excel de trabajadores y devuelve las filas válidas y las observaciones' })
  @ApiResponse({ status: 200, type: ImportPreviewDto })
  async previsualizar(@UploadedFile() archivo: Express.Multer.File | undefined): Promise<ImportPreviewDto> {
    if (archivo === undefined) {
      throw new BadRequestException('Selecciona un archivo');
    }
    return this.importacion.previsualizar(archivo.originalname, archivo.buffer);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registra los trabajadores validados con su vínculo laboral' })
  @ApiResponse({ status: 200, type: ImportResultDto })
  async importar(@Body() datos: ImportCommitDto, @SesionActual() sesion: SesionActiva, @Req() solicitud: Request): Promise<ImportResultDto> {
    return this.importacion.importar(datos.filas, sesion, datosCliente(solicitud));
  }
}
