import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BatchItemDialogComponent } from '../../components/batch-item-dialog/batch-item-dialog.component';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../../components/search-select/search-select.component';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../core/errors';
import { fechaHora } from '../../core/format';
import {
  CLASE_ESTADO_ITEM,
  CLASE_ESTADO_LOTE,
  ESTADOS_ITEM,
  TEXTO_ESTADO_DOCUMENTO,
  TEXTO_ESTADO_ITEM,
  TEXTO_ESTADO_LOTE,
  numeroSeccion,
  tamanoLegible,
} from '../../core/labels';
import type { EstadoItemLote, ItemLote } from '../../core/models';
import { BatchesService } from '../../services/batches.service';

const INTERVALO_MS = 3000;

@Component({
  selector: 'app-batch-detail',
  imports: [RouterLink, BatchItemDialogComponent, SkeletonComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './batch-detail.component.html',
  styleUrl: './batch-detail.component.css',
})
export class BatchDetailComponent {
  private readonly servicio = inject(BatchesService);

  readonly id = input.required<string>();

  protected readonly textoEstadoLote = TEXTO_ESTADO_LOTE;
  protected readonly claseEstadoLote = CLASE_ESTADO_LOTE;
  protected readonly textoEstadoItem = TEXTO_ESTADO_ITEM;
  protected readonly claseEstadoItem = CLASE_ESTADO_ITEM;
  protected readonly textoEstadoDocumento = TEXTO_ESTADO_DOCUMENTO;
  protected readonly numeroSeccion = numeroSeccion;
  protected readonly tamanoLegible = tamanoLegible;
  protected readonly fechaHora = fechaHora;

  protected readonly lote = resource({
    params: () => this.id(),
    loader: ({ params }) => this.servicio.obtener(params),
  });

  protected readonly secciones = resource({
    loader: () => this.servicio.secciones(),
  });

  protected readonly error = computed(() => {
    const error = this.lote.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly filtro = linkedSignal<string, EstadoItemLote | ''>({ source: this.id, computation: () => '' });
  protected readonly seleccionadoId = signal<string | null>(null);

  protected readonly items = computed(() => {
    if (!this.lote.hasValue()) {
      return [];
    }
    const estado = this.filtro();
    return this.lote.value().items.filter((item) => estado === '' || item.estado === estado);
  });

  protected readonly seleccionado = computed(() => {
    const id = this.seleccionadoId();
    if (id === null || !this.lote.hasValue()) {
      return null;
    }
    return this.lote.value().items.find((item) => item.id === id) ?? null;
  });

  protected readonly cuenta = computed(() => {
    if (!this.lote.hasValue()) {
      return new Map<EstadoItemLote, number>();
    }
    const mapa = new Map<EstadoItemLote, number>();
    for (const item of this.lote.value().items) {
      mapa.set(item.estado, (mapa.get(item.estado) ?? 0) + 1);
    }
    return mapa;
  });

  protected readonly opcionesFiltro = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: `Todos (${this.lote.hasValue() ? this.lote.value().total : 0})` },
    ...ESTADOS_ITEM.filter((estado) => this.total(estado) > 0).map((estado) => ({
      valor: estado,
      etiqueta: `${TEXTO_ESTADO_ITEM[estado]} (${this.total(estado)})`,
    })),
  ]);

  constructor() {
    effect((alLimpiar) => {
      if (!this.lote.hasValue()) {
        return;
      }
      const lote = this.lote.value();
      const activo =
        lote.estado === 'SUBIENDO' || lote.items.some((item) => item.documentos.some((documento) => documento.estado === 'PROCESANDO'));
      if (!activo) {
        return;
      }
      const temporizador = setTimeout(() => this.lote.reload(), INTERVALO_MS);
      alLimpiar(() => clearTimeout(temporizador));
    });
  }

  protected total(estado: EstadoItemLote): number {
    return this.cuenta().get(estado) ?? 0;
  }

  protected filtrar(valor: ValorOpcion): void {
    this.filtro.set(ESTADOS_ITEM.find((estado) => estado === valor) ?? '');
  }

  protected abrir(item: ItemLote): void {
    if (item.estado === 'PENDIENTE') {
      this.seleccionadoId.set(item.id);
    }
  }

  protected alActualizar(item: ItemLote): void {
    this.lote.update((actual) =>
      actual === undefined ? actual : { ...actual, items: actual.items.map((existente) => (existente.id === item.id ? item : existente)) },
    );
    this.lote.reload();
  }
}
