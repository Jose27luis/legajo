import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-marca',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marca.component.html',
  styleUrl: './marca.component.css',
})
export class MarcaComponent {
  readonly tamano = input<number>(36);
}
