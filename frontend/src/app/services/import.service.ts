import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { filter, firstValueFrom, map, type Observable } from 'rxjs';
import type { FilaImportacion, FormacionImportacion, ResultadoImportacion, VistaImportacion } from '../core/models';

const BASE = '/api/workers/import';

export type AvanceAnalisis = { tipo: 'subiendo'; porcentaje: number } | { tipo: 'analizando' } | { tipo: 'listo'; vista: VistaImportacion };

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);

  analizar(archivo: File): Observable<AvanceAnalisis> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post<VistaImportacion>(`${BASE}/preview`, datos, { observe: 'events', reportProgress: true }).pipe(
      map((evento): AvanceAnalisis | null => {
        if (evento.type === HttpEventType.UploadProgress) {
          const total = evento.total ?? archivo.size;
          const porcentaje = total > 0 ? Math.min(100, Math.round((evento.loaded / total) * 100)) : 0;
          return porcentaje >= 100 ? { tipo: 'analizando' } : { tipo: 'subiendo', porcentaje };
        }
        if (evento.type === HttpEventType.Response && evento.body !== null) {
          return { tipo: 'listo', vista: evento.body };
        }
        return null;
      }),
      filter((avance): avance is AvanceAnalisis => avance !== null),
    );
  }

  importar(filas: FilaImportacion[], completar: FormacionImportacion[]): Promise<ResultadoImportacion> {
    return firstValueFrom(this.http.post<ResultadoImportacion>(BASE, { filas, completar }));
  }
}
