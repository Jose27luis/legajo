import { ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { normalizarTexto } from '../../core/format';

export interface OpcionBuscable {
  valor: number;
  etiqueta: string;
  detalle?: string | null;
}

const MAXIMO_VISIBLES = 200;
const ALTO_LISTA = 300;

@Component({
  selector: 'app-search-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-select.component.html',
  styleUrl: './search-select.component.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchSelectComponent), multi: true }],
})
export class SearchSelectComponent implements ControlValueAccessor {
  readonly opciones = input<readonly OpcionBuscable[]>([]);
  readonly idCampo = input.required<string>();
  readonly invalido = input(false);
  readonly sugerencia = input('Busca o elige una opción');

  private readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');

  protected readonly valor = signal<number | null>(null);
  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  protected readonly activa = signal(-1);
  protected readonly arriba = signal(false);
  protected readonly deshabilitado = signal(false);

  protected readonly seleccionada = computed(() => this.opciones().find((opcion) => opcion.valor === this.valor()) ?? null);
  protected readonly textoElegido = computed(() => {
    const opcion = this.seleccionada();
    if (opcion === null) {
      return '';
    }
    return opcion.detalle ? `${opcion.etiqueta} · ${opcion.detalle}` : opcion.etiqueta;
  });

  protected readonly coincidencias = computed(() => {
    const termino = normalizarTexto(this.texto());
    const todas = this.opciones();
    return termino === ''
      ? todas
      : todas.filter((opcion) => normalizarTexto(`${opcion.etiqueta} ${opcion.detalle ?? ''}`).includes(termino));
  });

  protected readonly visibles = computed(() => this.coincidencias().slice(0, MAXIMO_VISIBLES));

  private alCambiar: (valor: number | null) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: unknown): void {
    this.valor.set(typeof valor === 'number' ? valor : null);
  }

  registerOnChange(funcion: (valor: number | null) => void): void {
    this.alCambiar = funcion;
  }

  registerOnTouched(funcion: () => void): void {
    this.alTocar = funcion;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  protected abrir(): void {
    if (this.abierto() || this.deshabilitado()) {
      return;
    }
    const caja = this.entrada().nativeElement.getBoundingClientRect();
    const debajo = window.innerHeight - caja.bottom;
    this.arriba.set(debajo < ALTO_LISTA && caja.top > debajo);
    this.texto.set('');
    const indice = this.visibles().findIndex((opcion) => opcion.valor === this.valor());
    this.activa.set(indice);
    this.abierto.set(true);
    if (indice >= 0) {
      this.mostrarActiva(indice);
    }
  }

  protected alternar(): void {
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    this.entrada().nativeElement.focus();
    this.abrir();
  }

  protected escribir(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.abrir();
      this.texto.set(evento.target.value);
      this.activa.set(this.visibles().length > 0 ? 0 : -1);
    }
  }

  protected teclado(evento: KeyboardEvent): void {
    const total = this.visibles().length;
    switch (evento.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        evento.preventDefault();
        if (!this.abierto()) {
          this.abrir();
          return;
        }
        if (total === 0) {
          return;
        }
        const paso = evento.key === 'ArrowDown' ? 1 : -1;
        const siguiente = (this.activa() + paso + total) % total;
        this.activa.set(siguiente);
        this.mostrarActiva(siguiente);
        return;
      }
      case 'Enter': {
        if (!this.abierto()) {
          return;
        }
        evento.preventDefault();
        const opcion = this.visibles()[this.activa()];
        if (opcion !== undefined) {
          this.elegir(opcion);
        }
        return;
      }
      case 'Escape':
        if (this.abierto()) {
          evento.preventDefault();
          evento.stopPropagation();
          this.cerrar();
        }
        return;
      case 'Tab':
        this.cerrar();
        return;
      default:
        return;
    }
  }

  protected elegir(opcion: OpcionBuscable): void {
    this.valor.set(opcion.valor);
    this.alCambiar(opcion.valor);
    this.cerrar();
  }

  protected alSalir(): void {
    this.cerrar();
  }

  private cerrar(): void {
    this.abierto.set(false);
    this.texto.set('');
    this.activa.set(-1);
    this.alTocar();
  }

  private mostrarActiva(indice: number): void {
    document.getElementById(`${this.idCampo()}-opcion-${indice}`)?.scrollIntoView({ block: 'nearest' });
  }
}
