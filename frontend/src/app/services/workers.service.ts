import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  DatosFamiliar,
  DatosNuevoVinculo,
  Familiar,
  FichaTrabajador,
  FiltrosPersonal,
  MotivoCambio,
  NuevoTrabajador,
  PaginaTrabajadores,
  ResumenPersonal,
  Situacion,
  TipoDocIdentidad,
  TrabajadorDetalle,
  TrabajadorResumen,
} from '../core/models';

const BASE = '/api/workers';

export function parametrosFiltro(filtros: FiltrosPersonal, conPagina: boolean): HttpParams {
  let parametros = new HttpParams();
  if (filtros.busqueda.trim() !== '') {
    parametros = parametros.set('busqueda', filtros.busqueda.trim());
  }
  if (filtros.estado !== '') {
    parametros = parametros.set('estado', filtros.estado);
  }
  if (filtros.movimiento !== '') {
    parametros = parametros.set('movimiento', filtros.movimiento);
  }
  if (filtros.areaId !== null) {
    parametros = parametros.set('areaId', filtros.areaId);
  }
  if (conPagina) {
    parametros = parametros.set('pagina', filtros.pagina).set('porPagina', 25);
  }
  return parametros;
}

@Injectable({ providedIn: 'root' })
export class WorkersService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosPersonal): Promise<PaginaTrabajadores> {
    return firstValueFrom(this.http.get<PaginaTrabajadores>(BASE, { params: parametrosFiltro(filtros, true) }));
  }

  enlaceExportacion(filtros: FiltrosPersonal): string {
    const consulta = parametrosFiltro(filtros, false).toString();
    return consulta === '' ? `${BASE}/export` : `${BASE}/export?${consulta}`;
  }

  resumen(): Promise<ResumenPersonal> {
    return firstValueFrom(this.http.get<ResumenPersonal>(`${BASE}/summary`));
  }

  buscarDocumento(tipo: TipoDocIdentidad, numero: string): Promise<{ existe: boolean; trabajador: TrabajadorResumen | null }> {
    return firstValueFrom(
      this.http.get<{ existe: boolean; trabajador: TrabajadorResumen | null }>(`${BASE}/lookup`, {
        params: new HttpParams().set('tipo', tipo).set('numero', numero),
      }),
    );
  }

  obtener(id: string): Promise<TrabajadorDetalle> {
    return firstValueFrom(this.http.get<TrabajadorDetalle>(`${BASE}/${id}`));
  }

  crear(datos: NuevoTrabajador): Promise<TrabajadorDetalle> {
    return firstValueFrom(this.http.post<TrabajadorDetalle>(BASE, datos));
  }

  editar(id: string, datos: FichaTrabajador): Promise<TrabajadorDetalle> {
    return firstValueFrom(this.http.patch<TrabajadorDetalle>(`${BASE}/${id}`, datos));
  }

  actualizarSituacion(id: string, datos: Situacion): Promise<TrabajadorDetalle> {
    return firstValueFrom(this.http.post<TrabajadorDetalle>(`${BASE}/${id}/situation`, datos));
  }

  reingresar(id: string, datos: DatosNuevoVinculo & { fechaIngreso: string }): Promise<TrabajadorDetalle> {
    return firstValueFrom(this.http.post<TrabajadorDetalle>(`${BASE}/${id}/reentry`, datos));
  }

  cambiarVinculo(
    id: string,
    datos: DatosNuevoVinculo & { fechaInicio: string; motivo: MotivoCambio },
  ): Promise<TrabajadorDetalle> {
    return firstValueFrom(this.http.post<TrabajadorDetalle>(`${BASE}/${id}/link-changes`, datos));
  }

  crearFamiliar(id: string, datos: DatosFamiliar): Promise<Familiar> {
    return firstValueFrom(this.http.post<Familiar>(`${BASE}/${id}/relatives`, datos));
  }

  editarFamiliar(id: string, familiarId: string, datos: DatosFamiliar): Promise<Familiar> {
    return firstValueFrom(this.http.patch<Familiar>(`${BASE}/${id}/relatives/${familiarId}`, datos));
  }

  quitarFamiliar(id: string, familiarId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${id}/relatives/${familiarId}`));
  }
}
