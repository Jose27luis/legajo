import { Injectable, inject, signal } from '@angular/core';
import type { Area, Cargo, Regimen } from '../core/models';
import { CatalogsService } from './catalogs.service';

export interface OpcionesVinculo {
  regimenes: Regimen[];
  cargos: Cargo[];
  areas: Area[];
}

@Injectable({ providedIn: 'root' })
export class LinkOptionsService {
  private readonly catalogos = inject(CatalogsService);
  private pendiente: Promise<OpcionesVinculo> | null = null;

  readonly opciones = signal<OpcionesVinculo | null>(null);

  cargar(forzar = false): Promise<OpcionesVinculo> {
    if (forzar || this.pendiente === null) {
      this.pendiente = Promise.all([this.catalogos.regimenes(), this.catalogos.cargos(), this.catalogos.areas()]).then(
        ([regimenes, cargos, areas]) => {
          const opciones = {
            regimenes: regimenes.filter((regimen) => regimen.activo),
            cargos: cargos.filter((cargo) => cargo.activo),
            areas: areas.filter((area) => area.activo),
          };
          this.opciones.set(opciones);
          return opciones;
        },
        (error: unknown) => {
          this.pendiente = null;
          throw error;
        },
      );
    }
    return this.pendiente;
  }
}
