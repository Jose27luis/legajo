import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { FiltrosAuditoria, OpcionesAuditoria, PaginaAuditoria } from '../core/models';

const BASE = '/api/audit';

function consulta(filtros: Record<keyof FiltrosAuditoria, string>): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== '') {
      params = params.set(clave, valor);
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosAuditoria, pagina: number): Promise<PaginaAuditoria> {
    return firstValueFrom(this.http.get<PaginaAuditoria>(BASE, { params: consulta(filtros).set('pagina', pagina) }));
  }

  opciones(): Promise<OpcionesAuditoria> {
    return firstValueFrom(this.http.get<OpcionesAuditoria>(`${BASE}/options`));
  }

  enlaceExcel(filtros: FiltrosAuditoria): string {
    const cadena = consulta(filtros).toString();
    return `${BASE}/export.xlsx${cadena === '' ? '' : `?${cadena}`}`;
  }
}
