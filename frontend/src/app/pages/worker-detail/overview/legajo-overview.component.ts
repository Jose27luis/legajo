import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { numeroSeccion } from '../../../core/labels';
import type { SeccionLegajo } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { DocumentsService } from '../../../services/documents.service';
import { WorkerContext } from '../worker-context';

@Component({
  selector: 'app-legajo-overview',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legajo-overview.component.html',
  styleUrl: './legajo-overview.component.css',
})
export class LegajoOverviewComponent {
  private readonly documentos = inject(DocumentsService);
  protected readonly contexto = inject(WorkerContext);
  protected readonly sesion = inject(SessionService);
  protected readonly numeroSeccion = numeroSeccion;

  protected readonly resumen = computed(() => {
    if (!this.contexto.legajo.hasValue()) {
      return null;
    }
    const lista = this.contexto.legajo.value().documentos;
    return {
      vigentes: lista.filter((documento) => documento.estado !== 'ANULADO').length,
      disponibles: lista.filter((documento) => documento.estado === 'DISPONIBLE').length,
      procesando: lista.filter((documento) => documento.estado === 'PROCESANDO').length,
      conError: lista.filter((documento) => documento.estado === 'ERROR').length,
      folios: lista
        .filter((documento) => documento.estado === 'DISPONIBLE')
        .reduce((suma, documento) => suma + (documento.versiones.find((version) => version.actual)?.paginas ?? 0), 0),
    };
  });

  protected readonly enlaceZip = computed(() => this.documentos.enlaceZip(this.contexto.id(), []));

  protected ruta(seccion: SeccionLegajo): string {
    return seccion.numero === 1 ? 'record' : `sections/${seccion.numero}`;
  }

  protected tipos(seccion: SeccionLegajo): string {
    const nombres = seccion.tipos.map((tipo) => tipo.nombre);
    return nombres.length > 3 ? `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} más` : nombres.join(', ');
  }

  protected campos(seccion: SeccionLegajo): string {
    return seccion.campos.map((campo) => campo.etiqueta).join(', ');
  }
}
