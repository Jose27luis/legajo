import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { DocumentDto } from '../documents/dto/document.dto';
import { CeseInputDto, LinkPeriodInputDto, MovementInputDto } from './dto/labor-input.dto';
import { LaborService } from './labor.service';

const ID = new ParseUUIDPipe({ version: '4' });

@ApiTags('Situación laboral')
@Requiere('personal.editar', 'documentos.ver')
@Controller('documents/:id')
export class LaborController {
  constructor(private readonly laboral: LaborService) {}

  @Post('link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vincula un contrato o resolución de primer ingreso al historial de la sección 01' })
  @ApiResponse({ status: 200, type: DocumentDto })
  async vincular(@Param('id', ID) id: string, @SesionActual() sesion: SesionActiva, @Req() solicitud: Request): Promise<DocumentDto> {
    return this.laboral.vincular(id, sesion, datosCliente(solicitud));
  }

  @Post('link-period')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enlaza un contrato o resolución ya registrado en la sección 02 a un período del historial laboral' })
  @ApiResponse({ status: 200, type: DocumentDto })
  async enlazarPeriodo(
    @Param('id', ID) id: string,
    @Body() datos: LinkPeriodInputDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentDto> {
    return this.laboral.enlazarPeriodo(id, datos.vinculoId, sesion, datosCliente(solicitud));
  }

  @Post('confirm-reentry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma el reingreso con el contrato de la sección 02 y deja al trabajador ACTIVO' })
  @ApiResponse({ status: 200, type: DocumentDto })
  async confirmarReingreso(
    @Param('id', ID) id: string,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentDto> {
    return this.laboral.confirmarReingreso(id, sesion, datosCliente(solicitud));
  }

  @Post('confirm-movement')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma el movimiento de la sección 07 y actualiza la ubicación del trabajador' })
  @ApiResponse({ status: 200, type: DocumentDto })
  async confirmarMovimiento(
    @Param('id', ID) id: string,
    @Body() datos: MovementInputDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentDto> {
    return this.laboral.confirmarMovimiento(id, datos, sesion, datosCliente(solicitud));
  }

  @Post('confirm-cese')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma el cese con el documento de la sección 11 y deja al trabajador CESADO' })
  @ApiResponse({ status: 200, type: DocumentDto })
  async confirmarCese(
    @Param('id', ID) id: string,
    @Body() datos: CeseInputDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<DocumentDto> {
    return this.laboral.confirmarCese(id, datos, sesion, datosCliente(solicitud));
  }
}
