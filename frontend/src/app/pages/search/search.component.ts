import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { WorkerPickerComponent } from '../../components/worker-picker/worker-picker.component';
import { mensajeDeError } from '../../core/errors';
import {
  CLASE_ESTADO_DOCUMENTO,
  ESTADOS_DOCUMENTO,
  TEXTO_ESTADO,
  TEXTO_ESTADO_DOCUMENTO,
  TEXTO_TIPO_PERSONAL,
  fechaCorta,
  nombreCompleto,
  numeroSeccion,
} from '../../core/labels';
import type { EstadoTrabajador, FiltrosBusqueda, TipoDocumento, TipoPersonal, TrabajadorLote } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { DocumentsService } from '../../services/documents.service';
import { FilterOptionsService } from '../../services/filter-options.service';
import { FILTROS_VACIOS, MAXIMO_SELECCION, SearchService } from '../../services/search.service';
import { WorkersService } from '../../services/workers.service';

const ESPERA_MS = 300;
const DNI = /^\d{8}$/;
const MINIMO = 2;

@Component({
  selector: 'app-search',
  imports: [RouterLink, WorkerPickerComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
})
export class SearchComponent {
  private readonly servicio = inject(SearchService);
  private readonly documentos = inject(DocumentsService);
  private readonly opcionesFiltro = inject(FilterOptionsService);
  private readonly avisos = inject(ToastService);
  private readonly trabajadores = inject(WorkersService);
  protected readonly sesion = inject(SessionService);

  readonly texto = input('', { transform: (valor: string | undefined) => valor ?? '' });

  protected readonly maximoSeleccion = MAXIMO_SELECCION;
  protected readonly estadosDocumento = ESTADOS_DOCUMENTO;
  protected readonly textoEstadoDocumento = TEXTO_ESTADO_DOCUMENTO;
  protected readonly claseEstadoDocumento = CLASE_ESTADO_DOCUMENTO;
  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly textoTipoPersonal = TEXTO_TIPO_PERSONAL;
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly numeroSeccion = numeroSeccion;
  protected readonly fechaCorta = fechaCorta;

  protected readonly opciones = resource({ loader: () => this.opcionesFiltro.cargar() });

  protected readonly borrador = linkedSignal<string, string>({ source: this.texto, computation: (texto) => texto });
  protected readonly filtros = linkedSignal<string, FiltrosBusqueda>({
    source: this.texto,
    computation: (texto) => ({ ...FILTROS_VACIOS, texto }),
  });
  protected readonly pagina = linkedSignal<FiltrosBusqueda, number>({ source: this.filtros, computation: () => 1 });
  protected readonly trabajador = signal<TrabajadorLote | null>(null);
  private desdeTexto = false;
  protected readonly marcados = signal<string[]>([]);
  protected readonly descargando = signal(false);

  protected readonly resultado = resource({
    params: () => ({ filtros: this.filtros(), pagina: this.pagina() }),
    loader: ({ params }) => this.servicio.avanzada(params.filtros, params.pagina),
  });

  protected readonly error = computed(() => {
    const error = this.resultado.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly tipos = computed<TipoDocumento[]>(() => {
    if (!this.opciones.hasValue()) {
      return [];
    }
    const seccion = this.filtros().seccion;
    return this.opciones
      .value()
      .secciones.filter((item) => seccion === null || item.numero === seccion)
      .flatMap((item) => item.tipos)
      .filter((tipo) => tipo.activo);
  });

  protected readonly enlaceExportacion = computed(() => this.servicio.enlaceExportacion(this.filtros()));

  protected readonly conFiltros = computed(() => {
    const filtros = this.filtros();
    return Object.entries(filtros).some(([clave, valor]) => clave !== 'texto' && valor !== null && valor !== '');
  });

  protected readonly totalTrabajadores = computed(() => (this.resultado.hasValue() ? this.resultado.value().trabajadores.total : 0));
  protected readonly totalDocumentos = computed(() => (this.resultado.hasValue() ? this.resultado.value().documentos.total : 0));
  protected readonly porPagina = computed(() => (this.resultado.hasValue() ? this.resultado.value().porPagina : 25));
  protected readonly ultimaPagina = computed(() =>
    Math.max(1, Math.ceil(Math.max(this.totalTrabajadores(), this.totalDocumentos()) / this.porPagina())),
  );

  constructor() {
    effect((alLimpiar) => {
      const escrito = this.borrador().trim();
      const aplicable = escrito.length >= MINIMO ? escrito : '';
      const temporizador = setTimeout(() => void this.aplicarTexto(aplicable), ESPERA_MS);
      alLimpiar(() => clearTimeout(temporizador));
    });
  }

  private async aplicarTexto(aplicable: string): Promise<void> {
    const elegido = this.trabajador();
    if (elegido !== null && this.desdeTexto && aplicable !== elegido.numeroDoc) {
      this.desdeTexto = false;
      this.trabajador.set(null);
      this.filtros.update((actual) => ({ ...actual, trabajadorId: null }));
    }
    if (DNI.test(aplicable) && this.trabajador()?.numeroDoc !== aplicable) {
      const encontrado = await this.trabajadores.buscarDocumento('DNI', aplicable).catch(() => null);
      if (encontrado?.trabajador && this.borrador().trim() === aplicable) {
        const trabajador = encontrado.trabajador;
        this.desdeTexto = true;
        this.trabajador.set({ id: trabajador.id, numeroDoc: trabajador.numeroDoc, nombre: nombreCompleto(trabajador) });
        this.filtros.update((actual) => ({ ...actual, texto: '', trabajadorId: trabajador.id }));
        return;
      }
    }
    if (this.desdeTexto && this.trabajador()?.numeroDoc === aplicable) {
      return;
    }
    if (aplicable !== this.filtros().texto) {
      this.filtros.update((actual) => ({ ...actual, texto: aplicable }));
    }
  }

  protected escribir(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.borrador.set(evento.target.value);
    }
  }

  protected cambiarSeccion(evento: Event): void {
    const valor = this.leer(evento);
    this.filtros.update((actual) => ({ ...actual, seccion: valor === '' ? null : Number(valor), tipoDocumentoId: null }));
  }

  protected cambiarTipo(evento: Event): void {
    const valor = this.leer(evento);
    this.filtros.update((actual) => ({ ...actual, tipoDocumentoId: valor === '' ? null : Number(valor) }));
  }

  protected cambiarArea(evento: Event): void {
    const valor = this.leer(evento);
    this.filtros.update((actual) => ({ ...actual, areaId: valor === '' ? null : Number(valor) }));
  }

  protected cambiarRegimen(evento: Event): void {
    const valor = this.leer(evento);
    this.filtros.update((actual) => ({ ...actual, regimenId: valor === '' ? null : Number(valor) }));
  }

  protected cambiarTipoPersonal(evento: Event): void {
    const valor = this.leer(evento);
    this.filtros.update((actual) => ({ ...actual, tipoPersonal: valor === '' ? null : (valor as TipoPersonal) }));
  }

  protected cambiarEstado(evento: Event): void {
    const valor = this.leer(evento);
    this.filtros.update((actual) => ({ ...actual, estado: valor === '' ? null : (valor as EstadoTrabajador) }));
  }

  protected cambiarEstadoDocumento(evento: Event): void {
    const valor = this.leer(evento);
    const estado = valor === 'TODOS' ? 'TODOS' : (ESTADOS_DOCUMENTO.find((item) => item === valor) ?? null);
    this.filtros.update((actual) => ({ ...actual, estadoDocumento: estado }));
  }

  protected elegirTrabajador(trabajador: TrabajadorLote | null): void {
    if (trabajador === null && this.desdeTexto) {
      this.borrador.set('');
    }
    this.desdeTexto = false;
    this.trabajador.set(trabajador);
    this.filtros.update((actual) => ({ ...actual, trabajadorId: trabajador?.id ?? null }));
  }

  protected cambiarDesde(evento: Event): void {
    this.filtros.update((actual) => ({ ...actual, desde: this.leer(evento) }));
  }

  protected cambiarHasta(evento: Event): void {
    this.filtros.update((actual) => ({ ...actual, hasta: this.leer(evento) }));
  }

  protected limpiar(): void {
    this.borrador.set('');
    this.filtros.set({ ...FILTROS_VACIOS });
    this.trabajador.set(null);
    this.desdeTexto = false;
    this.marcados.set([]);
  }

  protected marcado(id: string): boolean {
    return this.marcados().includes(id);
  }

  protected alternar(id: string): void {
    this.marcados.update((actual) => (actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]));
  }

  protected marcarPagina(): void {
    if (!this.resultado.hasValue()) {
      return;
    }
    const visibles = this.resultado
      .value()
      .documentos.items.filter((item) => item.documento.estado === 'DISPONIBLE')
      .map((item) => item.documento.id);
    this.marcados.update((actual) => {
      const todos = new Set([...actual, ...visibles]);
      return [...todos].slice(0, MAXIMO_SELECCION);
    });
  }

  protected enlacePdf(id: string): string {
    return this.documentos.enlaceArchivo(id, false);
  }

  protected async descargar(): Promise<void> {
    const ids = this.marcados();
    if (ids.length === 0 || this.descargando()) {
      return;
    }
    this.descargando.set(true);
    try {
      await this.servicio.descargarSeleccion(ids, `seleccion_${ids.length}_documentos`);
      this.avisos.exito(`Se preparó el ZIP con ${ids.length} documentos`);
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.descargando.set(false);
    }
  }

  private leer(evento: Event): string {
    if (evento.target instanceof HTMLSelectElement || evento.target instanceof HTMLInputElement) {
      return evento.target.value;
    }
    return '';
  }
}
