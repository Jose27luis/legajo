import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  forwardRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { normalizarTexto } from '../../core/format';

export type ValorOpcion = string | number | null;

export interface OpcionBuscable {
  valor: ValorOpcion;
  etiqueta: string;
  detalle?: string | null;
  deshabilitada?: boolean;
}

const MAXIMO_VISIBLES = 200;
const ALTO_LISTA = 300;
const ALTO_MINIMO = 160;
const SEPARACION = 6;
const MARGEN = 12;
const UMBRAL_BUSCADOR = 7;

interface PosicionPanel {
  izquierda: number;
  ancho: number;
  arriba: number | null;
  abajo: number | null;
  alto: number;
}

@Component({
  selector: 'app-search-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-select.component.html',
  styleUrl: './search-select.component.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchSelectComponent), multi: true }],
  host: { '[class.compacto]': 'compacto()' },
})
export class SearchSelectComponent implements ControlValueAccessor {
  readonly opciones = input<readonly OpcionBuscable[]>([]);
  readonly idCampo = input.required<string>();
  readonly invalido = input(false);
  readonly sugerencia = input('');
  readonly buscador = input<boolean | null>(null);
  readonly compacto = input(false);
  readonly seleccion = input<ValorOpcion | undefined>(undefined);
  readonly bloqueado = input(false);
  readonly descripcion = input<string | null>(null);
  readonly cambio = output<ValorOpcion>();

  private readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');

  protected readonly valor = linkedSignal<ValorOpcion>(() => this.seleccion() ?? null);
  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  protected readonly activa = signal(-1);
  protected readonly arriba = signal(false);
  protected readonly posicion = signal<PosicionPanel | null>(null);
  private readonly deshabilitadoPorFormulario = signal(false);
  private readonly alMoverse = (): void => this.ubicar();

  protected readonly deshabilitado = computed(() => this.bloqueado() || this.deshabilitadoPorFormulario());
  protected readonly conBuscador = computed(() => this.buscador() ?? this.opciones().length > UMBRAL_BUSCADOR);
  protected readonly textoSugerencia = computed(
    () => this.sugerencia() || (this.conBuscador() ? 'Busca o elige una opción' : 'Selecciona'),
  );

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

  constructor() {
    inject(DestroyRef).onDestroy(() => this.soltarEscuchas());
  }

  private alCambiar: (valor: ValorOpcion) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: unknown): void {
    this.valor.set(typeof valor === 'number' || typeof valor === 'string' ? valor : null);
  }

  registerOnChange(funcion: (valor: ValorOpcion) => void): void {
    this.alCambiar = funcion;
  }

  registerOnTouched(funcion: () => void): void {
    this.alTocar = funcion;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitadoPorFormulario.set(deshabilitado);
  }

  protected abrir(): void {
    if (this.abierto() || this.deshabilitado()) {
      return;
    }
    this.ubicar();
    window.addEventListener('resize', this.alMoverse, { passive: true });
    document.addEventListener('scroll', this.alMoverse, { capture: true, passive: true });
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
      this.activa.set(this.siguienteHabilitada(-1, 1));
    }
  }

  protected teclado(evento: KeyboardEvent): void {
    switch (evento.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        evento.preventDefault();
        if (!this.abierto()) {
          this.abrir();
          return;
        }
        const siguiente = this.siguienteHabilitada(this.activa(), evento.key === 'ArrowDown' ? 1 : -1);
        this.activa.set(siguiente);
        if (siguiente >= 0) {
          this.mostrarActiva(siguiente);
        }
        return;
      }
      case 'Enter':
      case ' ': {
        if (evento.key === ' ' && this.conBuscador()) {
          return;
        }
        evento.preventDefault();
        if (!this.abierto()) {
          this.abrir();
          return;
        }
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
    if (opcion.deshabilitada) {
      return;
    }
    const cambio = opcion.valor !== this.valor();
    this.valor.set(opcion.valor);
    this.cerrar();
    if (cambio) {
      this.alCambiar(opcion.valor);
      this.cambio.emit(opcion.valor);
    }
  }

  protected alSalir(): void {
    this.cerrar();
  }

  private siguienteHabilitada(desde: number, paso: 1 | -1): number {
    const opciones = this.visibles();
    const total = opciones.length;
    for (let intento = 1; intento <= total; intento++) {
      const indice = (((desde + paso * intento) % total) + total) % total;
      if (!opciones[indice]?.deshabilitada) {
        return indice;
      }
    }
    return -1;
  }

  private cerrar(): void {
    this.soltarEscuchas();
    this.abierto.set(false);
    this.posicion.set(null);
    this.texto.set('');
    this.activa.set(-1);
    this.alTocar();
  }

  private ubicar(): void {
    const caja = this.entrada().nativeElement.getBoundingClientRect();
    const debajo = window.innerHeight - caja.bottom - SEPARACION - MARGEN;
    const encima = caja.top - SEPARACION - MARGEN;
    const haciaArriba = debajo < Math.min(ALTO_LISTA, ALTO_MINIMO * 1.5) && encima > debajo;
    const ancho = Math.min(Math.max(caja.width, this.compacto() ? 220 : caja.width), window.innerWidth - MARGEN * 2);
    const izquierda = Math.min(Math.max(MARGEN, caja.left), window.innerWidth - ancho - MARGEN);
    this.arriba.set(haciaArriba);
    this.posicion.set({
      izquierda,
      ancho,
      arriba: haciaArriba ? null : caja.bottom + SEPARACION,
      abajo: haciaArriba ? window.innerHeight - caja.top + SEPARACION : null,
      alto: Math.max(ALTO_MINIMO, Math.min(ALTO_LISTA, haciaArriba ? encima : debajo)),
    });
  }

  private soltarEscuchas(): void {
    window.removeEventListener('resize', this.alMoverse);
    document.removeEventListener('scroll', this.alMoverse, { capture: true });
  }

  private mostrarActiva(indice: number): void {
    document.getElementById(`${this.idCampo()}-opcion-${indice}`)?.scrollIntoView({ block: 'nearest' });
  }
}
