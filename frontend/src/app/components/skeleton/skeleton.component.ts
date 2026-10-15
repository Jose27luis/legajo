import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type FormaEsqueleto = 'filas' | 'lista' | 'tarjetas' | 'texto' | 'ficha';

const ANCHOS = ['92%', '64%', '78%', '48%', '86%', '58%', '72%'];

@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.css',
  host: {
    role: 'status',
    'aria-busy': 'true',
    '[attr.aria-label]': 'texto()',
    '[class]': '"forma-" + forma()',
  },
})
export class SkeletonComponent {
  readonly forma = input<FormaEsqueleto>('filas');
  readonly cantidad = input(5);
  readonly columnas = input(4);
  readonly texto = input('Cargando');

  protected readonly elementos = computed(() => Array.from({ length: this.cantidad() }, (_, indice) => indice));
  protected readonly celdas = computed(() => Array.from({ length: this.columnas() }, (_, indice) => indice));

  protected ancho(indice: number): string {
    return ANCHOS[indice % ANCHOS.length] ?? '70%';
  }
}
