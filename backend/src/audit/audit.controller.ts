import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { AuditLogService } from './audit-log.service';
import { AuditOptionsDto, AuditPageDto } from './dto/audit-entry.dto';
import { AuditFiltersDto, AuditQueryDto } from './dto/audit-query.dto';

const EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Auditoría')
@Requiere('auditoria.ver')
@Controller('audit')
export class AuditController {
  constructor(private readonly registro: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Historial de acciones con filtros' })
  @ApiResponse({ status: 200, type: AuditPageDto })
  async listar(@Query() consulta: AuditQueryDto): Promise<AuditPageDto> {
    return this.registro.listar(consulta);
  }

  @Get('options')
  @ApiOperation({ summary: 'Acciones registradas y usuarios para los filtros' })
  @ApiResponse({ status: 200, type: AuditOptionsDto })
  async opciones(): Promise<AuditOptionsDto> {
    return this.registro.opciones();
  }

  @Get('export.xlsx')
  @ApiProduces(EXCEL)
  @ApiOperation({ summary: 'Exporta el historial filtrado' })
  @ApiResponse({ status: 200, description: 'Archivo de Excel' })
  async exportar(
    @Query() consulta: AuditFiltersDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res() respuesta: Response,
  ): Promise<void> {
    await this.registro.exportar(consulta, sesion, datosCliente(solicitud), respuesta);
  }
}
