import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spinner.component.html',
  styleUrl: './spinner.component.css',
  host: {
    role: 'status',
    '[attr.aria-label]': 'texto() || "Cargando"',
    '[class.bloque]': 'bloque()',
  },
})
export class SpinnerComponent {
  readonly texto = input('');
  readonly bloque = input(false);
}
