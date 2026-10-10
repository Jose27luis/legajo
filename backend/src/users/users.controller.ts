import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { datosCliente } from '../common/client';
import { Requiere, SesionActual } from '../common/decorators';
import type { SesionActiva } from '../common/session';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { RoleDto, TemporaryPasswordDto, UserDto } from './dto/user.dto';
import { UsersService } from './users.service';

const ID = new ParseUUIDPipe({ version: '4' });

@ApiTags('Usuarios')
@Requiere('usuarios.gestionar')
@Controller()
export class UsersController {
  constructor(private readonly usuarios: UsersService) {}

  @Get('users')
  @ApiOperation({ summary: 'Lista las cuentas de usuario' })
  @ApiResponse({ status: 200, type: [UserDto] })
  async listar(): Promise<UserDto[]> {
    return this.usuarios.listar();
  }

  @Get('roles')
  @ApiOperation({ summary: 'Lista los roles disponibles' })
  @ApiResponse({ status: 200, type: [RoleDto] })
  async listarRoles(): Promise<RoleDto[]> {
    return this.usuarios.listarRoles();
  }

  @Post('users')
  @ApiOperation({ summary: 'Crea una cuenta con contraseña temporal' })
  @ApiResponse({ status: 201, type: TemporaryPasswordDto })
  @ApiResponse({ status: 409, description: 'Usuario o correo en uso' })
  async crear(
    @Body() datos: CreateUserDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<TemporaryPasswordDto> {
    return this.usuarios.crear(datos, sesion, datosCliente(solicitud));
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Edita nombre, correo y rol de una cuenta' })
  @ApiResponse({ status: 200, type: UserDto })
  @ApiResponse({ status: 404, description: 'El usuario no existe' })
  async editar(
    @Param('id', ID) id: string,
    @Body() datos: UpdateUserDto,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<UserDto> {
    return this.usuarios.editar(id, datos, sesion, datosCliente(solicitud));
  }

  @Post('users/:id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activa una cuenta' })
  @ApiResponse({ status: 200, type: UserDto })
  async activar(
    @Param('id', ID) id: string,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<UserDto> {
    return this.usuarios.cambiarEstado(id, true, sesion, datosCliente(solicitud));
  }

  @Post('users/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactiva una cuenta y cierra sus sesiones' })
  @ApiResponse({ status: 200, type: UserDto })
  async desactivar(
    @Param('id', ID) id: string,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<UserDto> {
    return this.usuarios.cambiarEstado(id, false, sesion, datosCliente(solicitud));
  }

  @Post('users/:id/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desbloquea una cuenta bloqueada por intentos fallidos' })
  @ApiResponse({ status: 200, type: UserDto })
  async desbloquear(
    @Param('id', ID) id: string,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<UserDto> {
    return this.usuarios.desbloquear(id, sesion, datosCliente(solicitud));
  }

  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Genera una contraseña temporal y cierra las sesiones de la cuenta' })
  @ApiResponse({ status: 200, type: TemporaryPasswordDto })
  async restablecerClave(
    @Param('id', ID) id: string,
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
  ): Promise<TemporaryPasswordDto> {
    return this.usuarios.restablecerClave(id, sesion, datosCliente(solicitud));
  }
}
