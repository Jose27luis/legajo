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
import { hoy } from '../../core/labels';

type Vista = 'dias' | 'meses' | 'anios';

interface MesVisible {
  anio: number;
  mes: number;
}

interface Dia {
  iso: string;
  numero: number;
  delMes: boolean;
  esHoy: boolean;
  elegido: boolean;
  fuera: boolean;
  etiqueta: string;
}

interface Celda {
  valor: number;
  texto: string;
  actual: boolean;
  elegido: boolean;
  fuera: boolean;
}

interface PosicionPanel {
  izquierda: number;
  arriba: number | null;
  abajo: number | null;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const ANIOS_POR_PAGINA = 12;
const ANCHO_PANEL = 304;
const ALTO_PANEL = 372;
const SEPARACION = 6;
const MARGEN = 12;

function aIso(anio: number, mes: number, dia: number): string {
  return `${String(anio).padStart(4, '0')}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function leerIso(texto: string): { anio: number; mes: number; dia: number } | null {
  const partes = ISO.exec(texto);
  if (partes === null) {
    return null;
  }
  const anio = Number(partes[1]);
  const mes = Number(partes[2]) - 1;
  const dia = Number(partes[3]);
  const fecha = new Date(anio, mes, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes || fecha.getDate() !== dia) {
    return null;
  }
  return { anio, mes, dia };
}

function desplazar(iso: string, dias: number): string {
  const partes = leerIso(iso);
  if (partes === null) {
    return iso;
  }
  const fecha = new Date(partes.anio, partes.mes, partes.dia + dias);
  return aIso(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function desplazarMeses(iso: string, meses: number): string {
  const partes = leerIso(iso);
  if (partes === null) {
    return iso;
  }
  const destino = new Date(partes.anio, partes.mes + meses, 1);
  const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  return aIso(destino.getFullYear(), destino.getMonth(), Math.min(partes.dia, ultimo));
}

function aTexto(iso: string): string {
  const partes = leerIso(iso);
  return partes === null ? '' : `${String(partes.dia).padStart(2, '0')}/${String(partes.mes + 1).padStart(2, '0')}/${partes.anio}`;
}

function enmascarar(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) {
    return digitos;
  }
  if (digitos.length <= 4) {
    return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  }
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

function desdeTexto(texto: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (partes === null) {
    return null;
  }
  const iso = `${partes[3]}-${partes[2]}-${partes[1]}`;
  return leerIso(iso) === null ? null : iso;
}

@Component({
  selector: 'app-date-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePickerComponent), multi: true }],
})
export class DatePickerComponent implements ControlValueAccessor {
  readonly idCampo = input.required<string>();
  readonly fecha = input<string | undefined>(undefined);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly invalido = input(false);
  readonly descripcion = input<string | null>(null);
  readonly cambio = output<string>();

  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  private readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');

  protected readonly diasSemana = DIAS_SEMANA;
  protected readonly valor = linkedSignal<string>(() => this.fecha() ?? '');
  protected readonly texto = signal('');
  protected readonly editando = signal(false);
  protected readonly abierto = signal(false);
  protected readonly vista = signal<Vista>('dias');
  protected readonly mesVisible = signal<MesVisible>({ anio: 2000, mes: 0 });
  protected readonly activa = signal('');
  protected readonly posicion = signal<PosicionPanel | null>(null);
  private readonly deshabilitadoPorFormulario = signal(false);
  private readonly alMoverse = (): void => this.ubicar();

  protected readonly deshabilitado = computed(() => this.deshabilitadoPorFormulario());
  protected readonly hoy = computed(() => hoy());
  protected readonly textoVisible = computed(() => (this.editando() ? this.texto() : aTexto(this.valor())));
  protected readonly textoIncompleto = computed(() => this.editando() && this.texto() !== '' && desdeTexto(this.texto()) === null);
  protected readonly hoyPermitido = computed(() => !this.fuera(this.hoy()));

  protected readonly tituloMes = computed(() => `${MESES[this.mesVisible().mes]} ${this.mesVisible().anio}`);
  protected readonly inicioAnios = computed(() => Math.floor(this.mesVisible().anio / ANIOS_POR_PAGINA) * ANIOS_POR_PAGINA);
  protected readonly tituloAnios = computed(() => `${this.inicioAnios()} – ${this.inicioAnios() + ANIOS_POR_PAGINA - 1}`);

  protected readonly semanas = computed<Dia[][]>(() => {
    const { anio, mes } = this.mesVisible();
    const desfase = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const hoyIso = this.hoy();
    const elegido = this.valor();
    const dias: Dia[] = [];
    for (let indice = 0; indice < 42; indice++) {
      const fecha = new Date(anio, mes, 1 - desfase + indice);
      const iso = aIso(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
      dias.push({
        iso,
        numero: fecha.getDate(),
        delMes: fecha.getMonth() === mes,
        esHoy: iso === hoyIso,
        elegido: iso === elegido,
        fuera: this.fuera(iso),
        etiqueta: `${DIAS_SEMANA[indice % 7]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`,
      });
    }
    return Array.from({ length: 6 }, (_, fila) => dias.slice(fila * 7, fila * 7 + 7));
  });

  protected readonly meses = computed<Celda[]>(() => {
    const { anio } = this.mesVisible();
    const elegido = leerIso(this.valor());
    const actual = leerIso(this.hoy());
    return MESES_CORTOS.map((texto, mes) => ({
      valor: mes,
      texto,
      actual: actual !== null && actual.anio === anio && actual.mes === mes,
      elegido: elegido !== null && elegido.anio === anio && elegido.mes === mes,
      fuera: this.fuera(aIso(anio, mes, new Date(anio, mes + 1, 0).getDate()), aIso(anio, mes, 1)),
    }));
  });

  protected readonly anios = computed<Celda[]>(() => {
    const inicio = this.inicioAnios();
    const elegido = leerIso(this.valor());
    const actual = leerIso(this.hoy());
    return Array.from({ length: ANIOS_POR_PAGINA }, (_, indice) => {
      const anio = inicio + indice;
      return {
        valor: anio,
        texto: String(anio),
        actual: actual?.anio === anio,
        elegido: elegido?.anio === anio,
        fuera: this.fuera(aIso(anio, 11, 31), aIso(anio, 0, 1)),
      };
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.soltarEscuchas());
  }

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: unknown): void {
    this.valor.set(typeof valor === 'string' && leerIso(valor) !== null ? valor : '');
    this.editando.set(false);
  }

  registerOnChange(funcion: (valor: string) => void): void {
    this.alCambiar = funcion;
  }

  registerOnTouched(funcion: () => void): void {
    this.alTocar = funcion;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitadoPorFormulario.set(deshabilitado);
  }

  protected escribir(evento: Event): void {
    if (!(evento.target instanceof HTMLInputElement)) {
      return;
    }
    const enmascarado = enmascarar(evento.target.value);
    evento.target.value = enmascarado;
    this.texto.set(enmascarado);
    this.editando.set(true);
    if (enmascarado === '') {
      this.fijar('');
      return;
    }
    const iso = desdeTexto(enmascarado);
    if (iso !== null && !this.fuera(iso)) {
      this.fijar(iso);
      this.mostrarMes(iso);
    }
  }

  protected tecladoEntrada(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowDown' && (evento.altKey || !this.abierto())) {
      evento.preventDefault();
      this.abrir(true);
      return;
    }
    if (evento.key === 'Enter') {
      evento.preventDefault();
      this.confirmarTexto();
      return;
    }
    if (evento.key === 'Escape' && this.abierto()) {
      evento.preventDefault();
      evento.stopPropagation();
      this.cerrar();
    }
  }

  protected alternar(): void {
    if (this.abierto()) {
      this.cerrar();
      this.entrada().nativeElement.focus();
      return;
    }
    this.abrir(true);
  }

  protected alSalir(evento: FocusEvent): void {
    const destino = evento.relatedTarget;
    if (destino instanceof Node && this.contenedor().nativeElement.contains(destino)) {
      return;
    }
    this.confirmarTexto();
    this.cerrar();
    this.alTocar();
  }

  protected cambiarVista(vista: Vista): void {
    this.vista.set(vista);
  }

  protected mover(paso: number): void {
    const { anio, mes } = this.mesVisible();
    const vista = this.vista();
    if (vista === 'dias') {
      const destino = new Date(anio, mes + paso, 1);
      this.mesVisible.set({ anio: destino.getFullYear(), mes: destino.getMonth() });
      this.activa.set(desplazarMeses(this.activa() || aIso(anio, mes, 1), paso));
      return;
    }
    this.mesVisible.set({ anio: anio + paso * (vista === 'meses' ? 1 : ANIOS_POR_PAGINA), mes });
  }

  protected elegirDia(dia: Dia): void {
    if (!dia.fuera) {
      this.seleccionar(dia.iso);
    }
  }

  protected elegirMes(celda: Celda): void {
    if (celda.fuera) {
      return;
    }
    this.mesVisible.update((actual) => ({ ...actual, mes: celda.valor }));
    this.activa.set(aIso(this.mesVisible().anio, celda.valor, 1));
    this.vista.set('dias');
  }

  protected elegirAnio(celda: Celda): void {
    if (celda.fuera) {
      return;
    }
    this.mesVisible.update((actual) => ({ ...actual, anio: celda.valor }));
    this.vista.set('meses');
  }

  protected elegirHoy(): void {
    if (this.hoyPermitido()) {
      this.seleccionar(this.hoy());
    }
  }

  protected limpiar(): void {
    this.seleccionar('');
  }

  private seleccionar(iso: string): void {
    this.fijar(iso);
    this.editando.set(false);
    this.cerrar();
    this.entrada().nativeElement.focus();
  }

  protected tecladoDias(evento: KeyboardEvent): void {
    const actual = this.activa() || this.valor() || this.hoy();
    const partes = leerIso(actual);
    if (partes === null) {
      return;
    }
    const diaSemana = (new Date(partes.anio, partes.mes, partes.dia).getDay() + 6) % 7;
    const destinos: Record<string, () => string> = {
      ArrowLeft: () => desplazar(actual, -1),
      ArrowRight: () => desplazar(actual, 1),
      ArrowUp: () => desplazar(actual, -7),
      ArrowDown: () => desplazar(actual, 7),
      Home: () => desplazar(actual, -diaSemana),
      End: () => desplazar(actual, 6 - diaSemana),
      PageUp: () => desplazarMeses(actual, evento.shiftKey ? -12 : -1),
      PageDown: () => desplazarMeses(actual, evento.shiftKey ? 12 : 1),
    };
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      this.cerrar();
      this.entrada().nativeElement.focus();
      return;
    }
    const destino = destinos[evento.key];
    if (destino === undefined) {
      return;
    }
    evento.preventDefault();
    const iso = destino();
    if (this.fuera(iso)) {
      return;
    }
    this.activa.set(iso);
    this.mostrarMes(iso);
    this.enfocarActiva();
  }

  protected retenerFoco(evento: MouseEvent): void {
    if (!(evento.target instanceof Element) || evento.target.closest('button') === null) {
      evento.preventDefault();
    }
  }

  protected tabulable(dia: Dia): number {
    return dia.iso === this.activa() ? 0 : -1;
  }

  private abrir(enfocar: boolean): void {
    if (this.deshabilitado()) {
      return;
    }
    const base = this.valor() || (this.hoyPermitido() ? this.hoy() : (this.max() ?? this.min() ?? this.hoy()));
    this.activa.set(base);
    this.mostrarMes(base);
    this.vista.set('dias');
    this.ubicar();
    window.addEventListener('resize', this.alMoverse, { passive: true });
    document.addEventListener('scroll', this.alMoverse, { capture: true, passive: true });
    this.abierto.set(true);
    if (enfocar) {
      this.enfocarActiva();
    }
  }

  private cerrar(): void {
    this.soltarEscuchas();
    this.abierto.set(false);
    this.posicion.set(null);
  }

  private confirmarTexto(): void {
    if (!this.editando()) {
      return;
    }
    const texto = this.texto();
    if (texto === '') {
      this.fijar('');
    } else {
      const iso = desdeTexto(texto);
      if (iso !== null && !this.fuera(iso)) {
        this.fijar(iso);
      }
    }
    this.editando.set(false);
  }

  private fijar(iso: string): void {
    if (iso === this.valor()) {
      return;
    }
    this.valor.set(iso);
    this.alCambiar(iso);
    this.cambio.emit(iso);
  }

  private fuera(hasta: string, desde: string = hasta): boolean {
    const minimo = this.min();
    const maximo = this.max();
    return (minimo !== null && minimo !== '' && hasta < minimo) || (maximo !== null && maximo !== '' && desde > maximo);
  }

  private mostrarMes(iso: string): void {
    const partes = leerIso(iso);
    if (partes !== null) {
      this.mesVisible.set({ anio: partes.anio, mes: partes.mes });
    }
  }

  private enfocarActiva(): void {
    setTimeout(() => document.getElementById(`${this.idCampo()}-dia-${this.activa()}`)?.focus());
  }

  private ubicar(): void {
    const caja = this.entrada().nativeElement.getBoundingClientRect();
    const debajo = window.innerHeight - caja.bottom - SEPARACION - MARGEN;
    const haciaArriba = debajo < ALTO_PANEL && caja.top - SEPARACION - MARGEN > debajo;
    const izquierda = Math.min(Math.max(MARGEN, caja.left), Math.max(MARGEN, window.innerWidth - ANCHO_PANEL - MARGEN));
    this.posicion.set({
      izquierda,
      arriba: haciaArriba ? null : caja.bottom + SEPARACION,
      abajo: haciaArriba ? window.innerHeight - caja.top + SEPARACION : null,
    });
  }

  private soltarEscuchas(): void {
    window.removeEventListener('resize', this.alMoverse);
    document.removeEventListener('scroll', this.alMoverse, { capture: true });
  }
}
