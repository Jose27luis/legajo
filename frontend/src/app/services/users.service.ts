import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ClaveTemporal, DatosUsuario, NuevoUsuario, Rol, Usuario } from '../core/models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  listar(): Promise<Usuario[]> {
    return firstValueFrom(this.http.get<Usuario[]>('/api/users'));
  }

  listarRoles(): Promise<Rol[]> {
    return firstValueFrom(this.http.get<Rol[]>('/api/roles'));
  }

  crear(datos: NuevoUsuario): Promise<ClaveTemporal> {
    return firstValueFrom(this.http.post<ClaveTemporal>('/api/users', datos));
  }

  editar(id: string, datos: DatosUsuario): Promise<Usuario> {
    return firstValueFrom(this.http.patch<Usuario>(`/api/users/${id}`, datos));
  }

  activar(id: string): Promise<Usuario> {
    return firstValueFrom(this.http.post<Usuario>(`/api/users/${id}/activate`, {}));
  }

  desactivar(id: string): Promise<Usuario> {
    return firstValueFrom(this.http.post<Usuario>(`/api/users/${id}/deactivate`, {}));
  }

  desbloquear(id: string): Promise<Usuario> {
    return firstValueFrom(this.http.post<Usuario>(`/api/users/${id}/unlock`, {}));
  }

  restablecerClave(id: string): Promise<ClaveTemporal> {
    return firstValueFrom(this.http.post<ClaveTemporal>(`/api/users/${id}/reset-password`, {}));
  }
}
