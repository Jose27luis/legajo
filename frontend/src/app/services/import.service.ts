import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { FilaImportacion, ResultadoImportacion, VistaImportacion } from '../core/models';

const BASE = '/api/workers/import';

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);

  previsualizar(archivo: File): Promise<VistaImportacion> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return firstValueFrom(this.http.post<VistaImportacion>(`${BASE}/preview`, datos));
  }

  importar(filas: FilaImportacion[]): Promise<ResultadoImportacion> {
    return firstValueFrom(this.http.post<ResultadoImportacion>(BASE, { filas }));
  }
}
