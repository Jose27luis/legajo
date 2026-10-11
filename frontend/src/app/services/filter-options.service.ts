import { Injectable, inject } from '@angular/core';
import type { Area, Cargo, Regimen, Seccion } from '../core/models';
import { CatalogsService } from './catalogs.service';
import { LinkOptionsService } from './link-options.service';

export interface OpcionesFiltro {
  secciones: Seccion[];
  areas: Area[];
  regimenes: Regimen[];
  cargos: Cargo[];
}

@Injectable({ providedIn: 'root' })
export class FilterOptionsService {
  private readonly catalogos = inject(CatalogsService);
  private readonly vinculos = inject(LinkOptionsService);
  private pendiente: Promise<OpcionesFiltro> | null = null;

  cargar(): Promise<OpcionesFiltro> {
    if (this.pendiente === null) {
      this.pendiente = Promise.all([this.catalogos.secciones(), this.vinculos.cargar()]).then(
        ([secciones, opciones]) => ({
          secciones,
          areas: opciones.areas,
          regimenes: opciones.regimenes,
          cargos: opciones.cargos,
        }),
        (error: unknown) => {
          this.pendiente = null;
          throw error;
        },
      );
    }
    return this.pendiente;
  }
}
