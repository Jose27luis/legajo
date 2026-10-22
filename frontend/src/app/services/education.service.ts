import { Injectable, inject, signal } from '@angular/core';
import type { GradoInstruccion } from '../core/models';
import { CatalogsService } from './catalogs.service';

@Injectable({ providedIn: 'root' })
export class EducationService {
  private readonly catalogos = inject(CatalogsService);
  private pendiente: Promise<GradoInstruccion[]> | null = null;

  readonly grados = signal<GradoInstruccion[]>([]);

  cargar(): Promise<GradoInstruccion[]> {
    this.pendiente ??= this.catalogos.formacion().then(
      (lista) => {
        this.grados.set(lista);
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
