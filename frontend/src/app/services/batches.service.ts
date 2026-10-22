import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  ArchivoLote,
  DatosDocumento,
  ItemLote,
  Lote,
  LoteDetalle,
  ParteDivision,
  SeccionLegajo,
  VistaPreviaArchivo,
} from '../core/models';

const BASE = '/api/batches';

export const MAXIMO_ARCHIVOS = 500;

@Injectable({ providedIn: 'root' })
export class BatchesService {
  private readonly http = inject(HttpClient);

  previsualizar(nombres: string[]): Promise<VistaPreviaArchivo[]> {
    return firstValueFrom(this.http.post<VistaPreviaArchivo[]>(`${BASE}/preview`, { nombres }));
  }

  secciones(): Promise<SeccionLegajo[]> {
    return firstValueFrom(this.http.get<SeccionLegajo[]>(`${BASE}/sections`));
  }

  listar(): Promise<Lote[]> {
    return firstValueFrom(this.http.get<Lote[]>(BASE));
  }

  obtener(id: string): Promise<LoteDetalle> {
    return firstValueFrom(this.http.get<LoteDetalle>(`${BASE}/${id}`));
  }

  crear(archivos: ArchivoLote[]): Promise<LoteDetalle> {
    return firstValueFrom(this.http.post<LoteDetalle>(BASE, { archivos }));
  }

  avisarSubido(loteId: string, itemId: string, subidaId: string): Promise<ItemLote> {
    return firstValueFrom(this.http.post<ItemLote>(`${BASE}/${loteId}/items/${itemId}/uploaded`, { subidaId }));
  }

  clasificar(loteId: string, itemId: string, trabajadorId: string, datos: DatosDocumento): Promise<ItemLote> {
    return firstValueFrom(this.http.post<ItemLote>(`${BASE}/${loteId}/items/${itemId}/classify`, { ...datos, trabajadorId }));
  }

  dividir(loteId: string, itemId: string, partes: ParteDivision[]): Promise<ItemLote> {
    return firstValueFrom(this.http.post<ItemLote>(`${BASE}/${loteId}/items/${itemId}/split`, { partes }));
  }

  descartar(loteId: string, itemId: string, motivo: string): Promise<ItemLote> {
    return firstValueFrom(this.http.post<ItemLote>(`${BASE}/${loteId}/items/${itemId}/discard`, { motivo }));
  }

  eliminar(loteId: string, itemId: string, motivo: string): Promise<{ loteEliminado: boolean }> {
    return firstValueFrom(this.http.delete<{ loteEliminado: boolean }>(`${BASE}/${loteId}/items/${itemId}`, { body: { motivo } }));
  }

  enlaceArchivo(loteId: string, itemId: string): string {
    return `${BASE}/${loteId}/items/${itemId}/file`;
  }
}
