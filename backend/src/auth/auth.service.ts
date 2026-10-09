import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { DatosCliente } from '../comun/cliente';
import type { SesionActiva } from '../comun/sesion';
import { SesionService } from './sesion.service';
import { LimiteService } from './limite.service';
import type { IniciarSesionDto } from './dto/iniciar-sesion.dto';
import type { CambiarClaveDto } from './dto/cambiar-clave.dto';
import type { UsuarioSesionDto } from './dto/usuario-sesion.dto';

const MAXIMO_INTENTOS_FALLIDOS = 5;
const MINUTOS_DE_BLOQUEO = 15;
const MENSAJE_CREDENCIALES = 'Usuario o contraseña incorrectos';

const incluirPermisos = { rol: { include: { permisos: true } } } as const;

type UsuarioConPermisos = Prisma.UsuarioGetPayload<{ include: typeof incluirPermisos }>;

export interface ResultadoInicioSesion {
  sesion: SesionActiva;
  usuario: UsuarioSesionDto;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private hashDeReferencia = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiones: SesionService,
    private readonly limite: LimiteService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.hashDeReferencia = await argon2.hash(randomBytes(24).toString('base64url'), { type: argon2.argon2id });
  }

  async iniciarSesion(datos: IniciarSesionDto, cliente: DatosCliente): Promise<ResultadoInicioSesion> {
    const permitido = await this.limite.consumir(`login:ip:${cliente.ip ?? 'desconocida'}`, 10, 60);
    if (!permitido) {
      throw new HttpException('Demasiados intentos desde este equipo. Espera un minuto.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: datos.identificador.includes('@') ? { correo: datos.identificador } : { usuario: datos.identificador },
      include: incluirPermisos,
    });

    if (usuario === null || !usuario.activo) {
      await argon2.verify(this.hashDeReferencia, datos.clave);
      await this.auditoria.registrar({
        accion: 'LOGIN_FALLIDO',
        entidad: 'usuario',
        entidadId: usuario?.id ?? null,
        usuarioId: usuario?.id ?? null,
        cliente,
        detalle: { motivo: usuario === null ? 'usuario_inexistente' : 'cuenta_inactiva' },
      });
      throw new UnauthorizedException(MENSAJE_CREDENCIALES);
    }

    const ahora = new Date();
    if (usuario.bloqueadoHasta !== null && usuario.bloqueadoHasta > ahora) {
      await this.auditoria.registrar({
        accion: 'LOGIN_FALLIDO',
        entidad: 'usuario',
        entidadId: usuario.id,
        usuarioId: usuario.id,
        cliente,
        detalle: { motivo: 'cuenta_bloqueada' },
      });
      const minutos = Math.max(1, Math.ceil((usuario.bloqueadoHasta.getTime() - ahora.getTime()) / 60000));
      throw new HttpException(
        `Cuenta bloqueada temporalmente. Intenta de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} o pide al administrador que la desbloquee.`,
        HttpStatus.LOCKED,
      );
    }

    const claveValida = await argon2.verify(usuario.claveHash, datos.clave);
    if (!claveValida) {
      const quedoBloqueada = await this.registrarIntentoFallido(usuario.id, ahora, cliente);
      if (quedoBloqueada) {
        throw new HttpException(
          `Cuenta bloqueada por ${MINUTOS_DE_BLOQUEO} minutos tras ${MAXIMO_INTENTOS_FALLIDOS} intentos fallidos.`,
          HttpStatus.LOCKED,
        );
      }
      throw new UnauthorizedException(MENSAJE_CREDENCIALES);
    }

    await this.prisma.$transaction(async (transaccion) => {
      await transaccion.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: ahora },
      });
      await this.auditoria.registrar(
        { accion: 'LOGIN', entidad: 'usuario', entidadId: usuario.id, usuarioId: usuario.id, cliente },
        transaccion,
      );
    });

    const permisos = this.permisosDe(usuario);
    const sesion = await this.sesiones.crear({
      usuarioId: usuario.id,
      rol: usuario.rol.nombre,
      permisos,
      debeCambiarClave: usuario.debeCambiarClave,
    });
    return { sesion, usuario: this.aUsuarioSesion(usuario, permisos) };
  }

  async perfil(sesion: SesionActiva): Promise<UsuarioSesionDto> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: sesion.usuarioId }, include: incluirPermisos });
    if (usuario === null || !usuario.activo) {
      await this.sesiones.cerrar(sesion);
      throw new UnauthorizedException('Sesión no válida');
    }
    return this.aUsuarioSesion(usuario, this.permisosDe(usuario));
  }

  async cerrarSesion(sesion: SesionActiva, cliente: DatosCliente): Promise<void> {
    await this.sesiones.cerrar(sesion);
    await this.auditoria.registrar({
      accion: 'LOGOUT',
      entidad: 'usuario',
      entidadId: sesion.usuarioId,
      usuarioId: sesion.usuarioId,
      cliente,
    });
  }

  async cambiarClave(sesion: SesionActiva, datos: CambiarClaveDto, cliente: DatosCliente): Promise<UsuarioSesionDto> {
    const permitido = await this.limite.consumir(`clave:${sesion.usuarioId}`, 5, 15 * 60);
    if (!permitido) {
      throw new HttpException('Demasiados intentos. Espera 15 minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: sesion.usuarioId }, include: incluirPermisos });
    if (usuario === null || !usuario.activo) {
      await this.sesiones.cerrar(sesion);
      throw new UnauthorizedException('Sesión no válida');
    }

    const actualValida = await argon2.verify(usuario.claveHash, datos.claveActual);
    if (!actualValida) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (datos.claveNueva === datos.claveActual) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual');
    }

    const claveHash = await argon2.hash(datos.claveNueva, { type: argon2.argon2id });
    const actualizado = await this.prisma.$transaction(async (transaccion) => {
      const resultado = await transaccion.usuario.update({
        where: { id: usuario.id },
        data: { claveHash, debeCambiarClave: false },
        include: incluirPermisos,
      });
      await this.auditoria.registrar(
        { accion: 'CLAVE_CAMBIAR', entidad: 'usuario', entidadId: usuario.id, usuarioId: usuario.id, cliente },
        transaccion,
      );
      return resultado;
    });

    await this.sesiones.cerrarTodasDeUsuario(usuario.id, sesion.sid);
    await this.sesiones.actualizar({ ...sesion, debeCambiarClave: false });
    return this.aUsuarioSesion(actualizado, this.permisosDe(actualizado));
  }

  private async registrarIntentoFallido(usuarioId: string, ahora: Date, cliente: DatosCliente): Promise<boolean> {
    return this.prisma.$transaction(async (transaccion) => {
      const { intentosFallidos } = await transaccion.usuario.update({
        where: { id: usuarioId },
        data: { intentosFallidos: { increment: 1 } },
        select: { intentosFallidos: true },
      });
      const bloquear = intentosFallidos >= MAXIMO_INTENTOS_FALLIDOS;
      if (bloquear) {
        await transaccion.usuario.update({
          where: { id: usuarioId },
          data: { intentosFallidos: 0, bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_DE_BLOQUEO * 60000) },
        });
      }
      await this.auditoria.registrar(
        {
          accion: 'LOGIN_FALLIDO',
          entidad: 'usuario',
          entidadId: usuarioId,
          usuarioId,
          cliente,
          detalle: { motivo: 'clave_incorrecta', cuentaBloqueada: bloquear },
        },
        transaccion,
      );
      return bloquear;
    });
  }

  private permisosDe(usuario: UsuarioConPermisos): string[] {
    return usuario.rol.permisos.map((permiso) => permiso.permisoCodigo).sort();
  }

  private aUsuarioSesion(usuario: UsuarioConPermisos, permisos: string[]): UsuarioSesionDto {
    return {
      id: usuario.id,
      usuario: usuario.usuario,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      rol: usuario.rol.nombre,
      permisos,
      debeCambiarClave: usuario.debeCambiarClave,
      ultimoAcceso: usuario.ultimoAcceso === null ? null : usuario.ultimoAcceso.toISOString(),
    };
  }
}
