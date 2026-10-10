import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentTypesComponent } from './document-types/document-types.component';
import { RequirementsComponent } from './requirements/requirements.component';
import { RegimesComponent } from './regimes/regimes.component';
import { AreasComponent } from './areas/areas.component';
import { PositionsComponent } from './positions/positions.component';

const PESTANAS = [
  { id: 'document-types', etiqueta: 'Tipos de documento' },
  { id: 'requirements', etiqueta: 'Documentos obligatorios' },
  { id: 'regimes', etiqueta: 'Regímenes' },
  { id: 'areas', etiqueta: 'Áreas' },
  { id: 'positions', etiqueta: 'Cargos' },
] as const;

type IdPestana = (typeof PESTANAS)[number]['id'];

@Component({
  selector: 'app-catalogs',
  imports: [DocumentTypesComponent, RequirementsComponent, RegimesComponent, AreasComponent, PositionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogs.component.html',
  styleUrl: './catalogs.component.css',
})
export class CatalogsComponent {
  private readonly router = inject(Router);

  readonly tab = input<string>();

  protected readonly pestanas = PESTANAS;
  protected readonly activa = computed<IdPestana>(
    () => PESTANAS.find((pestana) => pestana.id === this.tab())?.id ?? 'document-types',
  );

  protected seleccionar(id: IdPestana): void {
    void this.router.navigate([], { queryParams: { tab: id }, replaceUrl: true });
  }

  protected moverConTeclado(evento: KeyboardEvent, indice: number): void {
    const desplazamiento = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    if (desplazamiento === 0) {
      return;
    }
    evento.preventDefault();
    const siguiente = PESTANAS[(indice + desplazamiento + PESTANAS.length) % PESTANAS.length];
    this.seleccionar(siguiente.id);
    document.getElementById(`pestana-${siguiente.id}`)?.focus();
  }
}
