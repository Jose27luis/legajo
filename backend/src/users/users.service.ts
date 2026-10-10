import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sinDuplicados } from '../common/unique-violation';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import type { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import type { RoleDto, TemporaryPasswordDto, UserDto } from './dto/user.dto';
import { generarClaveTemporal } from './temporary-password';

const ROL_ADMINISTRADOR = 'Administrador';
const incluirRol = { rol: true } as const;

type UsuarioConRol = Prisma.UsuarioGetPayload<{ include: typeof incluirRol }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
    private readonly sesiones: SessionService,
  ) {}

  async listar(): Promise<UserDto[]> {
    const usuarios = await this.prisma.usuario.findMany({
      include: incluirRol,
      orderBy: [{ activo: 'desc' }, { nombreCompleto: 'asc' }],
    });
    return usuarios.map((usuario) => this.aDto(usuario));
  }

  async listarRoles(): Promise<RoleDto[]> {
    const roles = await this.prisma.rol.findMany({ orderBy: { nombre: 'asc' } });
    return roles.map((rol) => ({ id: rol.id, nombre: rol.nombre, descripcion: rol.descripcion }));
  }

  async crear(datos: CreateUserDto, actor: SesionActiva, cliente: DatosCliente): Promise<TemporaryPasswordDto> {
    await this.exigirRol(datos.rolId);
    await this.exigirDisponible(datos.usuario, datos.correo);
    const claveTemporal = generarClaveTemporal();
    const claveHash = await argon2.hash(claveTemporal, { type: argon2.argon2id });

    const creado = await this.ejecutarSinDuplicados(() =>
      this.prisma.$transaction(async (transaccion) => {
        const usuario = await transaccion.usuario.create({
          data: {
            usuario: datos.usuario,
            nombreCompleto: datos.nombreCompleto,
            correo: datos.correo,
            rolId: datos.rolId,
            claveHash,
            debeCambiarClave: true,
          },
          include: incluirRol,
        });
        await this.auditoria.registrar(
          {
            accion: 'USUARIO_CREAR',
            entidad: 'usuario',
            entidadId: usuario.id,
            usuarioId: actor.usuarioId,
            cliente,
            detalle: { usuario: usuario.usuario, correo: usuario.correo, rol: usuario.rol.nombre },
          },
          transaccion,
        );
        return usuario;
      }),
    );
    return { usuario: this.aDto(creado), claveTemporal };
  }

  async editar(id: string, datos: UpdateUserDto, actor: SesionActiva, cliente: DatosCliente): Promise<UserDto> {
    const actual = await this.obtener(id);
    const nuevoRol = await this.exigirRol(datos.rolId);
    const cambiaRol = actual.rolId !== nuevoRol.id;

    if (cambiaRol && actual.id === actor.usuarioId) {
      throw new BadRequestException('No puedes cambiar tu propio rol');
    }
    if (cambiaRol && actual.activo && actual.rol.nombre === ROL_ADMINISTRADOR) {
      await this.exigirOtroAdministrador(actual.id);
    }
    if (datos.correo !== actual.correo) {
      await this.exigirDisponible(null, datos.correo);
    }

    const actualizado = await this.ejecutarSinDuplicados(() =>
      this.prisma.$transaction(async (transaccion) => {
        const usuario = await transaccion.usuario.update({
          where: { id },
          data: { nombreCompleto: datos.nombreCompleto, correo: datos.correo, rolId: nuevoRol.id },
          include: incluirRol,
        });
        await this.auditoria.registrar(
          {
            accion: 'USUARIO_EDITAR',
            entidad: 'usuario',
            entidadId: id,
            usuarioId: actor.usuarioId,
            cliente,
            detalle: {
              antes: { nombreCompleto: actual.nombreCompleto, correo: actual.correo, rol: actual.rol.nombre },
              despues: { nombreCompleto: usuario.nombreCompleto, correo: usuario.correo, rol: usuario.rol.nombre },
            },
          },
          transaccion,
        );
        return usuario;
      }),
    );

    if (cambiaRol) {
      await this.sesiones.cerrarTodasDeUsuario(id);
    }
    return this.aDto(actualizado);
  }

  async cambiarEstado(id: string, activo: boolean, actor: SesionActiva, cliente: DatosCliente): Promise<UserDto> {
    const actual = await this.obtener(id);
    if (actual.activo === activo) {
      return this.aDto(actual);
    }
    if (!activo && actual.id === actor.usuarioId) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }
    if (!activo && actual.rol.nombre === ROL_ADMINISTRADOR) {
      await this.exigirOtroAdministrador(actual.id);
    }

    const actualizado = await this.prisma.$transaction(async (transaccion) => {
      const usuario = await transaccion.usuario.update({ where: { id }, data: { activo }, include: incluirRol });
      await this.auditoria.registrar(
        {
          accion: activo ? 'USUARIO_ACTIVAR' : 'USUARIO_DESACTIVAR',
          entidad: 'usuario',
          entidadId: id,
          usuarioId: actor.usuarioId,
          cliente,
        },
        transaccion,
      );
      return usuario;
    });

    if (!activo) {
      await this.sesiones.cerrarTodasDeUsuario(id);
    }
    return this.aDto(actualizado);
  }

  async desbloquear(id: string, actor: SesionActiva, cliente: DatosCliente): Promise<UserDto> {
    await this.obtener(id);
    const actualizado = await this.prisma.$transaction(async (transaccion) => {
      const usuario = await transaccion.usuario.update({
        where: { id },
        data: { bloqueadoHasta: null, intentosFallidos: 0 },
        include: incluirRol,
      });
      await this.auditoria.registrar(
        { accion: 'USUARIO_DESBLOQUEAR', entidad: 'usuario', entidadId: id, usuarioId: actor.usuarioId, cliente },
        transaccion,
      );
      return usuario;
    });
    return this.aDto(actualizado);
  }

  async restablecerClave(id: string, actor: SesionActiva, cliente: DatosCliente): Promise<TemporaryPasswordDto> {
    const actual = await this.obtener(id);
    if (actual.id === actor.usuarioId) {
      throw new BadRequestException('Para cambiar tu propia contraseña usa Mi perfil');
    }
    const claveTemporal = generarClaveTemporal();
    const claveHash = await argon2.hash(claveTemporal, { type: argon2.argon2id });

    const actualizado = await this.prisma.$transaction(async (transaccion) => {
      const usuario = await transaccion.usuario.update({
        where: { id },
        data: { claveHash, debeCambiarClave: true, bloqueadoHasta: null, intentosFallidos: 0 },
        include: incluirRol,
      });
      await this.auditoria.registrar(
        { accion: 'USUARIO_RESTABLECER_CLAVE', entidad: 'usuario', entidadId: id, usuarioId: actor.usuarioId, cliente },
        transaccion,
      );
      return usuario;
    });

    await this.sesiones.cerrarTodasDeUsuario(id);
    return { usuario: this.aDto(actualizado), claveTemporal };
  }

  private async obtener(id: string): Promise<UsuarioConRol> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, include: incluirRol });
    if (usuario === null) {
      throw new NotFoundException('El usuario no existe');
    }
    return usuario;
  }

  private async exigirRol(rolId: string): Promise<{ id: string; nombre: string }> {
    const rol = await this.prisma.rol.findUnique({ where: { id: rolId }, select: { id: true, nombre: true } });
    if (rol === null) {
      throw new BadRequestException('El rol seleccionado no existe');
    }
    return rol;
  }

  private async exigirDisponible(usuario: string | null, correo: string): Promise<void> {
    const existente = await this.prisma.usuario.findFirst({
      where: { OR: [...(usuario === null ? [] : [{ usuario }]), { correo }] },
      select: { usuario: true, correo: true },
    });
    if (existente === null) {
      return;
    }
    throw new ConflictException(
      usuario !== null && existente.usuario === usuario
        ? 'Ya existe una cuenta con ese nombre de usuario'
        : 'Ya existe una cuenta con ese correo',
    );
  }

  private async exigirOtroAdministrador(excluirId: string): Promise<void> {
    const otros = await this.prisma.usuario.count({
      where: { id: { not: excluirId }, activo: true, rol: { nombre: ROL_ADMINISTRADOR } },
    });
    if (otros === 0) {
      throw new BadRequestException('Debe quedar al menos un Administrador activo');
    }
  }

  private ejecutarSinDuplicados<T>(operacion: () => Promise<T>): Promise<T> {
    return sinDuplicados(operacion, 'Ya existe una cuenta con ese nombre de usuario o correo');
  }

  private aDto(usuario: UsuarioConRol): UserDto {
    return {
      id: usuario.id,
      usuario: usuario.usuario,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      rol: { id: usuario.rol.id, nombre: usuario.rol.nombre },
      activo: usuario.activo,
      bloqueadoHasta:
        usuario.bloqueadoHasta !== null && usuario.bloqueadoHasta > new Date() ? usuario.bloqueadoHasta.toISOString() : null,
      debeCambiarClave: usuario.debeCambiarClave,
      ultimoAcceso: usuario.ultimoAcceso === null ? null : usuario.ultimoAcceso.toISOString(),
      creadoEn: usuario.creadoEn.toISOString(),
    };
  }
}
