import { Controller, Get, Param, ParseUUIDPipe, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import {
  DigitizationQueryDto,
  ExpiringQueryDto,
  MissingSummaryQueryDto,
  ProgressQueryDto,
  StaffReportQueryDto,
} from './dto/report-query.dto';
import {
  DigitizationReportDto,
  ExpiringReportDto,
  MissingSummaryDto,
  ProgressReportDto,
  StaffReportDto,
  WorkerMissingDto,
} from './dto/report.dto';
import { ReportsService } from './reports.service';

const ID = new ParseUUIDPipe({ version: '4' });
const EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Reportes')
@Requiere('reportes.ver')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportes: ReportsService) {}

  @Get('staff')
  @ApiOperation({ summary: 'Listado de personal con su completitud' })
  @ApiResponse({ status: 200, type: StaffReportDto })
  async personal(@Query() consulta: StaffReportQueryDto, @SesionActual() sesion: SesionActiva): Promise<StaffReportDto> {
    return this.reportes.personal(consulta, sesion);
  }

  @Get('staff.xlsx')
  @Requiere('reportes.ver', 'reportes.exportar')
  @ApiProduces(EXCEL)
  @ApiOperation({ summary: 'Exporta el listado de personal' })
  @ApiResponse({ status: 200, description: 'Archivo de Excel' })
  async exportarPersonal(
    @Query() consulta: StaffReportQueryDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.reportes.exportarPersonal(consulta, sesion, datosCliente(solicitud), respuesta);
  }

  @Get('missing-summary')
  @ApiOperation({ summary: 'Matriz de trabajadores por tipo obligatorio' })
  @ApiResponse({ status: 200, type: MissingSummaryDto })
  async consolidado(@Query() consulta: MissingSummaryQueryDto, @SesionActual() sesion: SesionActiva): Promise<MissingSummaryDto> {
    return this.reportes.consolidado(consulta, sesion);
  }

  @Get('missing-summary.xlsx')
  @Requiere('reportes.ver', 'reportes.exportar')
  @ApiProduces(EXCEL)
  @ApiOperation({ summary: 'Exporta el consolidado de faltantes' })
  @ApiResponse({ status: 200, description: 'Archivo de Excel' })
  async exportarConsolidado(
    @Query() consulta: MissingSummaryQueryDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.reportes.exportarConsolidado(consulta, sesion, datosCliente(solicitud), respuesta);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Documentos por vencer y vencidos' })
  @ApiResponse({ status: 200, type: ExpiringReportDto })
  async porVencer(@Query() consulta: ExpiringQueryDto, @SesionActual() sesion: SesionActiva): Promise<ExpiringReportDto> {
    return this.reportes.porVencer(consulta, sesion);
  }

  @Get('expiring.xlsx')
  @Requiere('reportes.ver', 'reportes.exportar')
  @ApiProduces(EXCEL)
  @ApiOperation({ summary: 'Exporta los documentos por vencer y vencidos' })
  @ApiResponse({ status: 200, description: 'Archivo de Excel' })
  async exportarPorVencer(
    @Query() consulta: ExpiringQueryDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.reportes.exportarPorVencer(consulta, sesion, datosCliente(solicitud), respuesta);
  }

  @Get('digitization')
  @ApiOperation({ summary: 'Documentos cargados por usuario y por día' })
  @ApiResponse({ status: 200, type: DigitizationReportDto })
  async digitalizacion(@Query() consulta: DigitizationQueryDto, @SesionActual() sesion: SesionActiva): Promise<DigitizationReportDto> {
    return this.reportes.digitalizacion(consulta, sesion);
  }

  @Get('digitization.xlsx')
  @Requiere('reportes.ver', 'reportes.exportar')
  @ApiProduces(EXCEL)
  @ApiOperation({ summary: 'Exporta el avance de digitalización' })
  @ApiResponse({ status: 200, description: 'Archivo de Excel' })
  async exportarDigitalizacion(
    @Query() consulta: DigitizationQueryDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.reportes.exportarDigitalizacion(consulta, sesion, datosCliente(solicitud), respuesta);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Avance de legajos por área' })
  @ApiResponse({ status: 200, type: ProgressReportDto })
  async avance(@Query() consulta: ProgressQueryDto, @SesionActual() sesion: SesionActiva): Promise<ProgressReportDto> {
    return this.reportes.avance(consulta, sesion);
  }

  @Get('progress.xlsx')
  @Requiere('reportes.ver', 'reportes.exportar')
  @ApiProduces(EXCEL)
  @ApiOperation({ summary: 'Exporta el avance de legajos' })
  @ApiResponse({ status: 200, description: 'Archivo de Excel' })
  async exportarAvance(
    @Query() consulta: ProgressQueryDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.reportes.exportarAvance(consulta, sesion, datosCliente(solicitud), respuesta);
  }

  @Get('missing/:trabajadorId')
  @ApiOperation({ summary: 'Requisitos del trabajador con su situación' })
  @ApiResponse({ status: 200, type: WorkerMissingDto })
  async faltantes(@Param('trabajadorId', ID) trabajadorId: string, @SesionActual() sesion: SesionActiva): Promise<WorkerMissingDto> {
    return this.reportes.faltantes(trabajadorId, sesion);
  }

  @Get('missing/:trabajadorId/export.xlsx')
  @Requiere('reportes.ver', 'reportes.exportar')
  @ApiProduces(EXCEL)
  @ApiOperation({ summary: 'Exporta los requisitos del trabajador' })
  @ApiResponse({ status: 200, description: 'Archivo de Excel' })
  async exportarFaltantes(
    @Param('trabajadorId', ID) trabajadorId: string,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.reportes.exportarFaltantes(trabajadorId, sesion, datosCliente(solicitud), respuesta);
  }
}
