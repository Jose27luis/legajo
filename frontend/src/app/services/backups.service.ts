import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { EstadoRespaldos, PanelRespaldos } from '../core/models';

const BASE = '/api/backups';

@Injectable({ providedIn: 'root' })
export class BackupsService {
  private readonly http = inject(HttpClient);

  panel(pagina: number): Promise<PanelRespaldos> {
    return firstValueFrom(this.http.get<PanelRespaldos>(BASE, { params: { pagina } }));
  }

  estado(): Promise<EstadoRespaldos> {
    return firstValueFrom(this.http.get<EstadoRespaldos>(`${BASE}/status`));
  }

  lanzar(): Promise<EstadoRespaldos> {
    return firstValueFrom(this.http.post<EstadoRespaldos>(BASE, {}));
  }
}
