import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ENTORNO, type Entorno } from '../environment/environment';
import { datosCliente } from '../common/client';
import { PermiteClavePendiente, Publico, SesionActual } from '../common/decorators';
import { NOMBRE_COOKIE_SESION, type SesionActiva } from '../common/session';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MessageDto, SessionUserDto } from './dto/session-user.dto';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión con usuario o correo y contraseña' })
  @ApiResponse({ status: 200, type: SessionUserDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 423, description: 'Cuenta bloqueada temporalmente' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  async iniciarSesion(
    @Body() datos: LoginDto,
    @Req() solicitud: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<SessionUserDto> {
    const { sesion, usuario } = await this.auth.iniciarSesion(datos, datosCliente(solicitud));
    respuesta.cookie(NOMBRE_COOKIE_SESION, sesion.sid, {
      httpOnly: true,
      secure: this.entorno.COOKIE_SEGURA,
      sameSite: 'strict',
      path: '/',
    });
    return usuario;
  }

  @PermiteClavePendiente()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra la sesión actual' })
  @ApiResponse({ status: 200, type: MessageDto })
  async cerrarSesion(
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<MessageDto> {
    await this.auth.cerrarSesion(sesion, datosCliente(solicitud));
    respuesta.clearCookie(NOMBRE_COOKIE_SESION, { path: '/' });
    return { mensaje: 'Sesión cerrada' };
  }

  @PermiteClavePendiente()
  @Get('me')
  @ApiOperation({ summary: 'Usuario de la sesión actual y sus permisos' })
  @ApiResponse({ status: 200, type: SessionUserDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  async yo(@SesionActual() sesion: SesionActiva): Promise<SessionUserDto> {
    return this.auth.perfil(sesion);
  }

  @PermiteClavePendiente()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambia la contraseña del usuario de la sesión' })
  @ApiResponse({ status: 200, type: SessionUserDto })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta o nueva inválida' })
  async cambiarClave(
    @SesionActual() sesion: SesionActiva,
    @Body() datos: ChangePasswordDto,
    @Req() solicitud: Request,
  ): Promise<SessionUserDto> {
    return this.auth.cambiarClave(sesion, datos, datosCliente(solicitud));
  }
}
