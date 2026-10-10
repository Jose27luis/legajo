import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, signal, viewChild } from '@angular/core';
import { tamanoLegible } from '../../core/labels';
import { TAMANO_MAXIMO_MB } from '../../services/documents.service';

@Component({
  selector: 'app-pdf-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-picker.component.html',
  styleUrl: './pdf-picker.component.css',
})
export class PdfPickerComponent {
  readonly archivo = model<File | null>(null);
  readonly progreso = input<number | null>(null);
  readonly deshabilitado = input(false);
  readonly idCampo = input.required<string>();
  readonly invalido = input(false);

  private readonly selector = viewChild.required<ElementRef<HTMLInputElement>>('selector');

  protected readonly arrastrando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tamanoMaximo = TAMANO_MAXIMO_MB;
  protected readonly tamano = computed(() => {
    const actual = this.archivo();
    return actual === null ? '' : tamanoLegible(actual.size);
  });

  limpiar(): void {
    this.archivo.set(null);
    this.error.set(null);
    this.selector().nativeElement.value = '';
  }

  protected alElegir(evento: Event): void {
    const elemento = evento.target;
    if (elemento instanceof HTMLInputElement) {
      this.tomar(elemento.files?.item(0) ?? null);
    }
  }

  protected alArrastrar(evento: DragEvent, encima: boolean): void {
    evento.preventDefault();
    if (!this.deshabilitado()) {
      this.arrastrando.set(encima);
    }
  }

  protected alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);
    if (!this.deshabilitado()) {
      this.tomar(evento.dataTransfer?.files.item(0) ?? null);
    }
  }

  protected quitar(): void {
    this.limpiar();
  }

  private tomar(elegido: File | null): void {
    if (elegido === null) {
      return;
    }
    if (!elegido.name.toLowerCase().endsWith('.pdf') || (elegido.type !== '' && elegido.type !== 'application/pdf')) {
      this.error.set('Solo se aceptan archivos PDF.');
      return;
    }
    if (elegido.size === 0) {
      this.error.set('El archivo está vacío.');
      return;
    }
    if (elegido.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      this.error.set(`El archivo supera los ${TAMANO_MAXIMO_MB} MB.`);
      return;
    }
    this.error.set(null);
    this.archivo.set(elegido);
  }
}
