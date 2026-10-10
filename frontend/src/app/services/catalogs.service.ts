import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  Area,
  Cargo,
  DatosTipoDocumento,
  NuevoRequisito,
  Regimen,
  Requisito,
  Seccion,
  TipoDocumento,
} from '../core/models';

const BASE = '/api/catalogs';

@Injectable({ providedIn: 'root' })
export class CatalogsService {
  private readonly http = inject(HttpClient);

  secciones(): Promise<Seccion[]> {
    return firstValueFrom(this.http.get<Seccion[]>(`${BASE}/sections`));
  }

  crearTipo(seccionId: number, datos: DatosTipoDocumento): Promise<TipoDocumento> {
    return firstValueFrom(this.http.post<TipoDocumento>(`${BASE}/document-types`, { ...datos, seccionId }));
  }

  editarTipo(id: number, datos: DatosTipoDocumento & { activo: boolean; orden: number }): Promise<TipoDocumento> {
    return firstValueFrom(this.http.patch<TipoDocumento>(`${BASE}/document-types/${id}`, datos));
  }

  requisitos(): Promise<Requisito[]> {
    return firstValueFrom(this.http.get<Requisito[]>(`${BASE}/requirements`));
  }

  crearRequisito(datos: NuevoRequisito): Promise<Requisito> {
    return firstValueFrom(this.http.post<Requisito>(`${BASE}/requirements`, datos));
  }

  quitarRequisito(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/requirements/${id}`));
  }

  regimenes(): Promise<Regimen[]> {
    return firstValueFrom(this.http.get<Regimen[]>(`${BASE}/regimes`));
  }

  crearRegimen(datos: Omit<Regimen, 'id'>): Promise<Regimen> {
    return firstValueFrom(this.http.post<Regimen>(`${BASE}/regimes`, datos));
  }

  editarRegimen(id: number, datos: Omit<Regimen, 'id' | 'codigo'>): Promise<Regimen> {
    return firstValueFrom(this.http.patch<Regimen>(`${BASE}/regimes/${id}`, datos));
  }

  areas(): Promise<Area[]> {
    return firstValueFrom(this.http.get<Area[]>(`${BASE}/areas`));
  }

  crearArea(datos: Omit<Area, 'id' | 'padreNombre'>): Promise<Area> {
    return firstValueFrom(this.http.post<Area>(`${BASE}/areas`, datos));
  }

  editarArea(id: number, datos: Omit<Area, 'id' | 'padreNombre'>): Promise<Area> {
    return firstValueFrom(this.http.patch<Area>(`${BASE}/areas/${id}`, datos));
  }

  cargos(): Promise<Cargo[]> {
    return firstValueFrom(this.http.get<Cargo[]>(`${BASE}/positions`));
  }

  crearCargo(datos: Omit<Cargo, 'id'>): Promise<Cargo> {
    return firstValueFrom(this.http.post<Cargo>(`${BASE}/positions`, datos));
  }

  editarCargo(id: number, datos: Omit<Cargo, 'id'>): Promise<Cargo> {
    return firstValueFrom(this.http.patch<Cargo>(`${BASE}/positions/${id}`, datos));
  }
}
