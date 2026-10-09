import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-marca',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marca.component.html',
  styleUrl: './marca.component.css',
})
export class MarcaComponent {
  readonly tamano = input<number>(36);
  readonly conFondo = input<boolean>(false);

  protected readonly relleno = computed(() => (this.conFondo() ? Math.round(this.tamano() * 0.15) : 0));
  protected readonly tamanoDibujo = computed(() => this.tamano() - this.relleno() * 2);
}
