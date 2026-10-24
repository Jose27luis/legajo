import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pager.component.html',
  styleUrl: './pager.component.css',
})
export class PagerComponent {
  readonly pagina = input.required<number>();
  readonly paginas = input.required<number>();
  readonly total = input<number | null>(null);
  readonly unidad = input<readonly [string, string]>(['elemento', 'elementos']);
  readonly etiqueta = input('Páginas');
  readonly cambio = output<number>();

  protected readonly resumen = computed(() => {
    const total = this.total();
    if (total === null) {
      return null;
    }
    const [singular, plural] = this.unidad();
    return `${total} ${total === 1 ? singular : plural}`;
  });

  protected ir(pagina: number): void {
    if (pagina >= 1 && pagina <= this.paginas() && pagina !== this.pagina()) {
      this.cambio.emit(pagina);
    }
  }
}
