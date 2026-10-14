import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { numeroSeccion, tonoSeccion } from '../../../core/labels';
import type { SeccionLegajo } from '../../../core/models';
import { WorkerContext } from '../worker-context';

@Component({
  selector: 'app-legajo-overview',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legajo-overview.component.html',
  styleUrl: './legajo-overview.component.css',
})
export class LegajoOverviewComponent {
  protected readonly contexto = inject(WorkerContext);
  protected readonly numeroSeccion = numeroSeccion;
  protected readonly tono = tonoSeccion;

  protected readonly resumen = computed(() => {
    if (!this.contexto.legajo.hasValue()) {
      return null;
    }
    const lista = this.contexto.legajo.value().documentos;
    return {
      registrados: lista.filter((documento) => documento.estado === 'DISPONIBLE').length,
      procesando: lista.filter((documento) => documento.estado === 'PROCESANDO').length,
      conError: lista.filter((documento) => documento.estado === 'ERROR').length,
    };
  });

  protected ruta(seccion: SeccionLegajo): string {
    return seccion.numero === 1 ? 'record' : `sections/${seccion.numero}`;
  }

  protected cuenta(seccion: SeccionLegajo): string {
    if (seccion.restringida) {
      return 'Restringida';
    }
    if (seccion.numero === 1) {
      return 'Ficha';
    }
    return `${seccion.total} PDF`;
  }
}
