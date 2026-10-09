import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { UsuarioSesion } from './modelos';

@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly http = inject(HttpClient);
  private readonly estado = signal<UsuarioSesion | null>(null);
  private verificacion: Promise<UsuarioSesion | null> | null = null;

  readonly usuario = this.estado.asReadonly();
  readonly autenticado = computed(() => this.estado() !== null);

  asegurar(): Promise<UsuarioSesion | null> {
    const actual = this.estado();
    if (actual !== null) {
      return Promise.resolve(actual);
    }
    this.verificacion ??= firstValueFrom(this.http.get<UsuarioSesion>('/api/auth/yo'))
      .then(
        (usuario) => {
          this.estado.set(usuario);
          return usuario;
        },
        () => null,
      )
      .finally(() => {
        this.verificacion = null;
      });
    return this.verificacion;
  }

  async iniciar(identificador: string, clave: string): Promise<UsuarioSesion> {
    const usuario = await firstValueFrom(this.http.post<UsuarioSesion>('/api/auth/login', { identificador, clave }));
    this.estado.set(usuario);
    return usuario;
  }

  async cambiarClave(claveActual: string, claveNueva: string): Promise<UsuarioSesion> {
    const usuario = await firstValueFrom(
      this.http.post<UsuarioSesion>('/api/auth/cambiar-clave', { claveActual, claveNueva }),
    );
    this.estado.set(usuario);
    return usuario;
  }

  async cerrar(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<{ mensaje: string }>('/api/auth/logout', {}));
    } finally {
      this.estado.set(null);
    }
  }

  limpiar(): void {
    this.estado.set(null);
  }

  tiene(permiso: string): boolean {
    return this.estado()?.permisos.includes(permiso) ?? false;
  }
}
