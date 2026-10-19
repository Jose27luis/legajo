import { Injectable, inject, signal } from '@angular/core';
import type { DepartamentoUbigeo } from '../core/models';
import { CatalogsService } from './catalogs.service';

@Injectable({ providedIn: 'root' })
export class UbigeoService {
  private readonly catalogos = inject(CatalogsService);
  private pendiente: Promise<DepartamentoUbigeo[]> | null = null;

  readonly departamentos = signal<DepartamentoUbigeo[]>([]);

  cargar(): Promise<DepartamentoUbigeo[]> {
    this.pendiente ??= this.catalogos.ubigeo().then(
      (lista) => {
        this.departamentos.set(lista);
        return lista;
      },
      (error: unknown) => {
        this.pendiente = null;
        throw error;
      },
    );
    return this.pendiente;
  }
}
