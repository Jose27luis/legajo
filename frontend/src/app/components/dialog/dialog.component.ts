import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

let siguienteId = 1;

@Component({
  selector: 'app-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
})
export class DialogComponent {
  readonly abierto = input.required<boolean>();
  readonly titulo = input.required<string>();
  readonly angosto = input<boolean>(false);
  readonly ancho = input<boolean>(false);
  readonly cerrar = output();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  protected readonly idTitulo = `dialogo-titulo-${siguienteId++}`;

  constructor() {
    effect(() => {
      const elemento = this.dialogo().nativeElement;
      if (this.abierto() && !elemento.open) {
        elemento.showModal();
      } else if (!this.abierto() && elemento.open) {
        elemento.close();
      }
    });
  }

  protected alCancelar(evento: Event): void {
    evento.preventDefault();
    this.cerrar.emit();
  }

  protected alPulsarFondo(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement) {
      this.cerrar.emit();
    }
  }
}
