import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ENTORNO, type Entorno } from '../entorno/entorno';
import { datosCliente } from '../comun/cliente';
import { PermiteClavePendiente, Publico, SesionActual } from '../comun/decoradores';
import { NOMBRE_COOKIE_SESION, type SesionActiva } from '../comun/sesion';
import { AuthService } from './auth.service';
import { IniciarSesionDto } from './dto/iniciar-sesion.dto';
import { CambiarClaveDto } from './dto/cambiar-clave.dto';
import { MensajeDto, UsuarioSesionDto } from './dto/usuario-sesion.dto';

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
  @ApiResponse({ status: 200, type: UsuarioSesionDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 423, description: 'Cuenta bloqueada temporalmente' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  async iniciarSesion(
    @Body() datos: IniciarSesionDto,
    @Req() solicitud: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<UsuarioSesionDto> {
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
  @ApiResponse({ status: 200, type: MensajeDto })
  async cerrarSesion(
    @SesionActual() sesion: SesionActiva,
    @Req() solicitud: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<MensajeDto> {
    await this.auth.cerrarSesion(sesion, datosCliente(solicitud));
    respuesta.clearCookie(NOMBRE_COOKIE_SESION, { path: '/' });
    return { mensaje: 'Sesión cerrada' };
  }

  @PermiteClavePendiente()
  @Get('yo')
  @ApiOperation({ summary: 'Usuario de la sesión actual y sus permisos' })
  @ApiResponse({ status: 200, type: UsuarioSesionDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  async yo(@SesionActual() sesion: SesionActiva): Promise<UsuarioSesionDto> {
    return this.auth.perfil(sesion);
  }

  @PermiteClavePendiente()
  @Post('cambiar-clave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambia la contraseña del usuario de la sesión' })
  @ApiResponse({ status: 200, type: UsuarioSesionDto })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta o nueva inválida' })
  async cambiarClave(
    @SesionActual() sesion: SesionActiva,
    @Body() datos: CambiarClaveDto,
    @Req() solicitud: Request,
  ): Promise<UsuarioSesionDto> {
    return this.auth.cambiarClave(sesion, datos, datosCliente(solicitud));
  }
}
