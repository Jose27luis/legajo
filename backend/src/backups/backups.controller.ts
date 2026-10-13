import { Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { BackupsService } from './backups.service';
import { BackupPanelDto, BackupQueryDto, BackupStatusDto } from './dto/backup.dto';

@ApiTags('Copias de seguridad')
@Requiere('backup.gestionar')
@Controller('backups')
export class BackupsController {
  constructor(private readonly respaldos: BackupsService) {}

  @Get()
  @ApiOperation({ summary: 'Última copia, historial, copias guardadas y espacio usado' })
  @ApiResponse({ status: 200, type: BackupPanelDto })
  async panel(@Query() consulta: BackupQueryDto): Promise<BackupPanelDto> {
    return this.respaldos.panel(consulta.pagina ?? 1);
  }

  @Get('status')
  @ApiOperation({ summary: 'Estado de la última copia' })
  @ApiResponse({ status: 200, type: BackupStatusDto })
  async estado(): Promise<BackupStatusDto> {
    return this.respaldos.estado();
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Pone en cola una copia manual' })
  @ApiResponse({ status: 202, type: BackupStatusDto })
  @ApiResponse({ status: 409, description: 'Ya hay una copia en curso o en cola' })
  async lanzar(@SesionActual() sesion: SesionActiva, @Req() solicitud: Request): Promise<BackupStatusDto> {
    return this.respaldos.lanzar(sesion, datosCliente(solicitud));
  }
}
