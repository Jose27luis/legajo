import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  FaltantesTrabajador,
  FiltrosAvance,
  FiltrosConsolidado,
  FiltrosDigitalizacion,
  FiltrosReporteGeneral,
  FiltrosReportePersonal,
  Indicadores,
  ReporteGeneral,
  FiltrosVencimientos,
  ReporteAvance,
  ReporteConsolidado,
  ReporteDigitalizacion,
  ReportePersonal,
  ReporteVencimientos,
} from '../core/models';

const BASE = '/api/reports';

type Filtros = Record<string, string | number | boolean | null>;

function consulta(filtros: Filtros): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== null && valor !== '' && valor !== false) {
      params = params.set(clave, String(valor));
    }
  }
  return params;
}

function texto(filtros: Filtros): string {
  const cadena = consulta(filtros).toString();
  return cadena === '' ? '' : `?${cadena}`;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);

  personal(filtros: FiltrosReportePersonal, pagina: number): Promise<ReportePersonal> {
    return firstValueFrom(this.http.get<ReportePersonal>(`${BASE}/staff`, { params: consulta({ ...filtros, pagina }) }));
  }

  enlacePersonal(filtros: FiltrosReportePersonal): string {
    return `${BASE}/staff.xlsx${texto({ ...filtros })}`;
  }

  faltantes(trabajadorId: string): Promise<FaltantesTrabajador> {
    return firstValueFrom(this.http.get<FaltantesTrabajador>(`${BASE}/missing/${trabajadorId}`));
  }

  enlaceFaltantes(trabajadorId: string): string {
    return `${BASE}/missing/${trabajadorId}/export.xlsx`;
  }

  consolidado(filtros: FiltrosConsolidado, pagina: number): Promise<ReporteConsolidado> {
    return firstValueFrom(this.http.get<ReporteConsolidado>(`${BASE}/missing-summary`, { params: consulta({ ...filtros, pagina }) }));
  }

  enlaceConsolidado(filtros: FiltrosConsolidado): string {
    return `${BASE}/missing-summary.xlsx${texto({ ...filtros })}`;
  }

  vencimientos(filtros: FiltrosVencimientos): Promise<ReporteVencimientos> {
    return firstValueFrom(this.http.get<ReporteVencimientos>(`${BASE}/expiring`, { params: consulta({ ...filtros }) }));
  }

  enlaceVencimientos(filtros: FiltrosVencimientos): string {
    return `${BASE}/expiring.xlsx${texto({ ...filtros })}`;
  }

  digitalizacion(filtros: FiltrosDigitalizacion): Promise<ReporteDigitalizacion> {
    return firstValueFrom(this.http.get<ReporteDigitalizacion>(`${BASE}/digitization`, { params: consulta({ ...filtros }) }));
  }

  enlaceDigitalizacion(filtros: FiltrosDigitalizacion): string {
    return `${BASE}/digitization.xlsx${texto({ ...filtros })}`;
  }

  avance(filtros: FiltrosAvance): Promise<ReporteAvance> {
    return firstValueFrom(this.http.get<ReporteAvance>(`${BASE}/progress`, { params: consulta({ ...filtros }) }));
  }

  enlaceAvance(filtros: FiltrosAvance): string {
    return `${BASE}/progress.xlsx${texto({ ...filtros })}`;
  }

  general(filtros: FiltrosReporteGeneral, todos = false): Promise<ReporteGeneral> {
    return firstValueFrom(this.http.get<ReporteGeneral>(`${BASE}/general`, { params: consulta({ ...filtros, todos }) }));
  }

  enlaceGeneral(filtros: FiltrosReporteGeneral): string {
    return `${BASE}/general.xlsx${texto({ ...filtros })}`;
  }

  indicadores(): Promise<Indicadores> {
    return firstValueFrom(this.http.get<Indicadores>(`${BASE}/statistics`));
  }

  enlaceIndicadores(): string {
    return `${BASE}/statistics.xlsx`;
  }
}
