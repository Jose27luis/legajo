import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { FiltrosBusqueda, ResultadoBusqueda, ResultadoRapido } from '../core/models';

const BASE = '/api/search';

export const MAXIMO_SELECCION = 100;

export const FILTROS_VACIOS: FiltrosBusqueda = {
  texto: '',
  seccion: null,
  tipoDocumentoId: null,
  desde: '',
  hasta: '',
  areaId: null,
  regimenId: null,
  tipoPersonal: null,
  estado: null,
  estadoDocumento: null,
  trabajadorId: null,
};

function parametros(filtros: FiltrosBusqueda): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== null && valor !== '') {
      params = params.set(clave, String(valor));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);

  rapida(texto: string): Promise<ResultadoRapido> {
    return firstValueFrom(this.http.get<ResultadoRapido>(`${BASE}/quick`, { params: { texto } }));
  }

  avanzada(filtros: FiltrosBusqueda, pagina: number): Promise<ResultadoBusqueda> {
    const params = parametros(filtros).set('pagina', pagina);
    return firstValueFrom(this.http.get<ResultadoBusqueda>(BASE, { params }));
  }

  enlaceExportacion(filtros: FiltrosBusqueda): string {
    const consulta = parametros(filtros).toString();
    return consulta === '' ? `${BASE}/documents.xlsx` : `${BASE}/documents.xlsx?${consulta}`;
  }

  async descargarSeleccion(ids: string[], nombre: string): Promise<void> {
    const archivo = await firstValueFrom(this.http.post(`${BASE}/zip`, { ids }, { responseType: 'blob' }));
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = `${nombre}.zip`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }
}
