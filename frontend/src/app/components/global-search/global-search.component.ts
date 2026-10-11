import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { numeroSeccion } from '../../core/labels';
import { SearchService } from '../../services/search.service';

const ESPERA_MS = 250;
const MINIMO = 2;

interface Opcion {
  clave: string;
  grupo: 'Trabajadores' | 'Documentos' | '';
  etiqueta: string;
  detalle: string;
  ruta: string[];
  texto: string | null;
}

@Component({
  selector: 'app-global-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './global-search.component.html',
  styleUrl: './global-search.component.css',
  host: {
    '(document:click)': 'alPulsarDocumento($event)',
    '(document:keydown.escape)': 'cerrar()',
    '(document:keydown.control.k)': 'enfocar($event)',
    '(document:keydown.meta.k)': 'enfocar($event)',
  },
})
export class GlobalSearchComponent {
  private readonly servicio = inject(SearchService);
  private readonly router = inject(Router);
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  private readonly termino = signal('');

  protected readonly resultados = resource({
    params: () => (this.termino().length < MINIMO ? undefined : this.termino()),
    loader: ({ params }) => this.servicio.rapida(params),
  });

  protected readonly opciones = computed<Opcion[]>(() => {
    const termino = this.termino();
    if (termino.length < MINIMO) {
      return [];
    }
    const lista: Opcion[] = [];
    if (this.resultados.hasValue()) {
      const resultado = this.resultados.value();
      for (const trabajador of resultado.trabajadores) {
        lista.push({
          clave: `t-${trabajador.id}`,
          grupo: 'Trabajadores',
          etiqueta: trabajador.nombre,
          detalle: [trabajador.numeroDoc, trabajador.cargo, trabajador.area].filter((parte) => parte !== null && parte !== '').join(' · '),
          ruta: ['/workers', trabajador.id],
          texto: null,
        });
      }
      for (const documento of resultado.documentos) {
        lista.push({
          clave: `d-${documento.id}`,
          grupo: 'Documentos',
          etiqueta: documento.tipo,
          detalle: [documento.trabajador, documento.numero, documento.fechaEmision].filter((parte) => parte !== null && parte !== '').join(' · '),
          ruta: ['/workers', documento.trabajadorId, 'sections', numeroSeccion(documento.seccion)],
          texto: null,
        });
      }
    }
    lista.push({
      clave: 'todos',
      grupo: '',
      etiqueta: `Ver todos los resultados de "${termino}"`,
      detalle: 'Búsqueda avanzada con filtros',
      ruta: ['/search'],
      texto: termino,
    });
    return lista;
  });

  protected readonly activo = linkedSignal<Opcion[], number>({ source: this.opciones, computation: () => 0 });

  protected readonly buscando = computed(() => this.termino().length >= MINIMO && this.resultados.isLoading());

  constructor() {
    effect((alLimpiar) => {
      const texto = this.texto().trim();
      const temporizador = setTimeout(() => this.termino.set(texto), ESPERA_MS);
      alLimpiar(() => clearTimeout(temporizador));
    });
  }

  protected alEscribir(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.texto.set(evento.target.value);
      this.abierto.set(true);
    }
  }

  protected alTeclear(evento: KeyboardEvent): void {
    const opciones = this.opciones();
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (opciones.length === 0) {
        return;
      }
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      this.activo.set((this.activo() + paso + opciones.length) % opciones.length);
      this.abierto.set(true);
      return;
    }
    if (evento.key === 'Enter') {
      evento.preventDefault();
      const elegida = opciones[this.activo()] ?? opciones.at(-1);
      if (elegida !== undefined) {
        this.ir(elegida);
      }
    }
  }

  protected ir(opcion: Opcion): void {
    this.abierto.set(false);
    this.campo().nativeElement.blur();
    const consulta = opcion.texto === null ? {} : { queryParams: { texto: opcion.texto } };
    void this.router.navigate(opcion.ruta, consulta);
    this.texto.set('');
    this.termino.set('');
  }

  protected enfocar(evento: Event): void {
    evento.preventDefault();
    this.campo().nativeElement.focus();
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected irAvanzada(): void {
    void this.router.navigate(['/search']);
  }

  protected alPulsarDocumento(evento: Event): void {
    if (evento.target instanceof Node && !this.anfitrion.nativeElement.contains(evento.target)) {
      this.abierto.set(false);
    }
  }
}
