import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CandidatoJefatura, DesignacionMasiva, Jefaturas, RevisionMasiva } from '../core/models';

const BASE = '/api/headships';

@Injectable({ providedIn: 'root' })
export class HeadshipsService {
  private readonly http = inject(HttpClient);

  listar(): Promise<Jefaturas> {
    return firstValueFrom(this.http.get<Jefaturas>(BASE));
  }

  candidatos(areaId: number): Promise<CandidatoJefatura[]> {
    return firstValueFrom(this.http.get<CandidatoJefatura[]>(`${BASE}/candidates`, { params: new HttpParams().set('areaId', areaId) }));
  }

  revisar(datos: DesignacionMasiva): Promise<RevisionMasiva> {
    return firstValueFrom(this.http.post<RevisionMasiva>(`${BASE}/bulk/preview`, datos));
  }

  registrar(datos: DesignacionMasiva, subidaId: string): Promise<{ documentos: string[] }> {
    return firstValueFrom(this.http.post<{ documentos: string[] }>(`${BASE}/bulk`, { ...datos, subidaId }));
  }
}
