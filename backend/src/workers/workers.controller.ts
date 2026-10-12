import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import {
  CreateWorkerDto,
  LinkChangeDto,
  LookupQueryDto,
  ReentryDto,
  RelativeInputDto,
  SituationDto,
  UpdateWorkerDto,
  WorkerQueryDto,
} from './dto/worker-input.dto';
import { RelativeDto, WorkerDetailDto, WorkerLookupDto, WorkerPageDto, WorkerSummaryDto } from './dto/worker.dto';
import { RelativesService } from './relatives.service';
import { WorkerLinksService } from './worker-links.service';
import { WorkersService } from './workers.service';

const ID = new ParseUUIDPipe({ version: '4' });

@ApiTags('Personal')
@Controller('workers')
export class WorkersController {
  constructor(
    private readonly trabajadores: WorkersService,
    private readonly vinculos: WorkerLinksService,
    private readonly familiares: RelativesService,
  ) {}

  @Requiere('personal.ver')
  @Get()
  @ApiOperation({ summary: 'Listado de trabajadores con búsqueda y filtros' })
  @ApiResponse({ status: 200, type: WorkerPageDto })
  async listar(@Query() consulta: WorkerQueryDto, @SesionActual() sesion: SesionActiva): Promise<WorkerPageDto> {
    return this.trabajadores.listar(consulta, sesion);
  }

  @Requiere('personal.ver')
  @Get('summary')
  @ApiOperation({ summary: 'Indicadores del personal e ingresos recientes' })
  @ApiResponse({ status: 200, type: WorkerSummaryDto })
  async resumen(): Promise<WorkerSummaryDto> {
    return this.trabajadores.resumen();
  }

  @Requiere('personal.ver', 'reportes.exportar')
  @Get('export')
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOperation({ summary: 'Exporta el listado filtrado en Excel' })
  @ApiResponse({ status: 200, description: 'Archivo de Excel' })
  async exportar(@Query() consulta: WorkerQueryDto, @Res() respuesta: Response): Promise<void> {
    await this.trabajadores.exportar(consulta, respuesta);
  }

  @Requiere('personal.ver')
  @Get('lookup')
  @ApiOperation({ summary: 'Comprueba si un documento de identidad ya tiene legajo' })
  @ApiResponse({ status: 200, type: WorkerLookupDto })
  async buscarDocumento(@Query() consulta: LookupQueryDto): Promise<WorkerLookupDto> {
    return this.trabajadores.buscarDocumento(consulta);
  }

  @Requiere('personal.editar')
  @Post()
  @ApiOperation({ summary: 'Registra un nuevo ingreso con su vínculo inicial' })
  @ApiResponse({ status: 201, type: WorkerDetailDto })
  @ApiResponse({ status: 409, description: 'El documento ya tiene legajo' })
  async crear(
    @Body() datos: CreateWorkerDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<WorkerDetailDto> {
    return this.trabajadores.crear(datos, sesion, datosCliente(solicitud));
  }

  @Requiere('personal.ver')
  @Get(':id')
  @ApiOperation({ summary: 'Ficha del trabajador con vínculos y familiares' })
  @ApiResponse({ status: 200, type: WorkerDetailDto })
  @ApiResponse({ status: 404, description: 'No existe' })
  async obtener(@Param('id', ID) id: string): Promise<WorkerDetailDto> {
    return this.trabajadores.obtener(id);
  }

  @Requiere('personal.editar')
  @Patch(':id')
  @ApiOperation({ summary: 'Edita la ficha del trabajador' })
  @ApiResponse({ status: 200, type: WorkerDetailDto })
  async editar(
    @Param('id', ID) id: string,
    @Body() datos: UpdateWorkerDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<WorkerDetailDto> {
    return this.trabajadores.editar(id, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('personal.editar')
  @Post(':id/situation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza el movimiento actual o registra el cese' })
  @ApiResponse({ status: 200, type: WorkerDetailDto })
  async situacion(
    @Param('id', ID) id: string,
    @Body() datos: SituationDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<WorkerDetailDto> {
    return this.vinculos.actualizarSituacion(id, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('personal.editar')
  @Post(':id/reentry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registra el reingreso al mismo legajo' })
  @ApiResponse({ status: 200, type: WorkerDetailDto })
  async reingreso(
    @Param('id', ID) id: string,
    @Body() datos: ReentryDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<WorkerDetailDto> {
    return this.vinculos.reingresar(id, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('personal.editar')
  @Post(':id/link-changes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra el vínculo vigente y abre otro por renovación o cambio de régimen, cargo o área' })
  @ApiResponse({ status: 200, type: WorkerDetailDto })
  async cambioVinculo(
    @Param('id', ID) id: string,
    @Body() datos: LinkChangeDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<WorkerDetailDto> {
    return this.vinculos.cambiarVinculo(id, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('personal.editar')
  @Post(':id/relatives')
  @ApiOperation({ summary: 'Agrega un familiar' })
  @ApiResponse({ status: 201, type: RelativeDto })
  async crearFamiliar(
    @Param('id', ID) id: string,
    @Body() datos: RelativeInputDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<RelativeDto> {
    return this.familiares.crear(id, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('personal.editar')
  @Patch(':id/relatives/:familiarId')
  @ApiOperation({ summary: 'Edita un familiar' })
  @ApiResponse({ status: 200, type: RelativeDto })
  async editarFamiliar(
    @Param('id', ID) id: string,
    @Param('familiarId', ID) familiarId: string,
    @Body() datos: RelativeInputDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<RelativeDto> {
    return this.familiares.editar(id, familiarId, datos, sesion, datosCliente(solicitud));
  }

  @Requiere('personal.editar')
  @Delete(':id/relatives/:familiarId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quita un familiar' })
  @ApiResponse({ status: 204, description: 'Quitado' })
  async quitarFamiliar(
    @Param('id', ID) id: string,
    @Param('familiarId', ID) familiarId: string,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<void> {
    await this.familiares.quitar(id, familiarId, sesion, datosCliente(solicitud));
  }
}
