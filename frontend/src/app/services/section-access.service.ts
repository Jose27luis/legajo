import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { PermisoRolSeccion, PermisosSeccion } from '../core/models';

const BASE = '/api/section-access';

@Injectable({ providedIn: 'root' })
export class SectionAccessService {
  private readonly http = inject(HttpClient);

  listar(): Promise<PermisosSeccion> {
    return firstValueFrom(this.http.get<PermisosSeccion>(BASE));
  }

  actualizar(rolId: string, restringidas: number[]): Promise<PermisoRolSeccion> {
    return firstValueFrom(this.http.put<PermisoRolSeccion>(`${BASE}/${rolId}`, { restringidas }));
  }
}
