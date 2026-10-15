import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReentryDialogComponent } from '../reentry-dialog/reentry-dialog.component';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../search-select/search-select.component';
import { SituationDialogComponent } from '../situation-dialog/situation-dialog.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { mensajeDeError } from '../../core/errors';
import {
  CLASE_MOVIMIENTO,
  MOVIMIENTOS,
  TEXTO_ESTADO,
  TEXTO_MOTIVO_FIN,
  TEXTO_MOVIMIENTO,
  TEXTO_TIPO_PERSONAL,
  nombreCompleto,
  puedeReingresar,
} from '../../core/labels';
import type { EstadoTrabajador, FiltrosPersonal, Movimiento, TrabajadorDetalle, TrabajadorResumen } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { LinkOptionsService } from '../../services/link-options.service';
import { WorkersService } from '../../services/workers.service';

const ESPERA_BUSQUEDA_MS = 300;

const OPCIONES_ESTADO: readonly OpcionBuscable[] = [
  { valor: null, etiqueta: 'Todos' },
  { valor: 'ACTIVO', etiqueta: 'Activos' },
  { valor: 'CESADO', etiqueta: 'Cesados' },
];

const OPCIONES_MOVIMIENTO: readonly OpcionBuscable[] = [
  { valor: null, etiqueta: 'Todos' },
  ...MOVIMIENTOS.map((movimiento) => ({ valor: movimiento, etiqueta: TEXTO_MOVIMIENTO[movimiento] })),
];

@Component({
  selector: 'app-worker-directory',
  imports: [RouterLink, SituationDialogComponent, ReentryDialogComponent, SkeletonComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './worker-directory.component.html',
  styleUrl: './worker-directory.component.css',
})
export class WorkerDirectoryComponent implements OnInit {
  private readonly servicio = inject(WorkersService);
  private readonly opcionesServicio = inject(LinkOptionsService);
  private readonly avisos = inject(ToastService);
  protected readonly sesion = inject(SessionService);

  readonly titulo = input('Trabajadores registrados');
  readonly estadoInicial = input<EstadoTrabajador | ''>('');
  readonly movimientoInicial = input<Movimiento | ''>('');
  readonly conExportar = input(true);
  readonly cambio = output();

  private readonly situacion = viewChild.required(SituationDialogComponent);
  private readonly reingreso = viewChild.required(ReentryDialogComponent);
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected readonly opcionesEstado = OPCIONES_ESTADO;
  protected readonly opcionesMovimiento = OPCIONES_MOVIMIENTO;
  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly claseMovimiento = CLASE_MOVIMIENTO;
  protected readonly textoMotivo = TEXTO_MOTIVO_FIN;
  protected readonly textoTipoPersonal = TEXTO_TIPO_PERSONAL;
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly puedeReingresar = puedeReingresar;

  protected readonly textoBusqueda = signal('');
  protected readonly busqueda = signal('');
  protected readonly estado = linkedSignal(() => this.estadoInicial());
  protected readonly movimiento = linkedSignal(() => this.movimientoInicial());
  protected readonly areaId = signal<number | null>(null);
  protected readonly pagina = signal(1);
  protected readonly opcionesArea = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todas las áreas' },
    ...(this.opcionesServicio.opciones()?.areas ?? []).map((area) => ({ valor: area.id, etiqueta: area.nombre })),
  ]);

  protected readonly filtros = computed<FiltrosPersonal>(() => ({
    busqueda: this.busqueda(),
    estado: this.estado(),
    movimiento: this.movimiento(),
    areaId: this.areaId(),
    pagina: this.pagina(),
  }));

  protected readonly listado = resource({
    params: () => this.filtros(),
    loader: ({ params }) => this.servicio.listar(params),
  });

  readonly enlaceExportacion = computed(() => this.servicio.enlaceExportacion(this.filtros()));
  protected readonly errorListado = computed(() => {
    const error = this.listado.error();
    return error === undefined ? null : mensajeDeError(error);
  });
  protected readonly rango = computed(() => {
    const pagina = this.listado.value();
    if (pagina === undefined || pagina.total === 0) {
      return '0 trabajadores';
    }
    const desde = (pagina.pagina - 1) * pagina.porPagina + 1;
    const hasta = Math.min(pagina.pagina * pagina.porPagina, pagina.total);
    return `${desde} a ${hasta} de ${pagina.total}`;
  });
  protected readonly hayAnterior = computed(() => this.pagina() > 1);
  protected readonly haySiguiente = computed(() => {
    const pagina = this.listado.value();
    return pagina !== undefined && pagina.pagina * pagina.porPagina < pagina.total;
  });

  protected readonly paraSituacion = signal<TrabajadorResumen | null>(null);
  protected readonly paraReingreso = signal<TrabajadorResumen | null>(null);

  ngOnInit(): void {
    this.opcionesServicio.cargar().catch((error: unknown) => this.avisos.error(mensajeDeError(error)));
  }

  protected escribirBusqueda(evento: Event): void {
    if (!(evento.target instanceof HTMLInputElement)) {
      return;
    }
    const valor = evento.target.value;
    this.textoBusqueda.set(valor);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.busqueda.set(valor);
      this.pagina.set(1);
    }, ESPERA_BUSQUEDA_MS);
  }

  protected cambiarEstado(valor: ValorOpcion): void {
    this.estado.set(valor === 'ACTIVO' || valor === 'CESADO' ? valor : '');
    this.pagina.set(1);
  }

  protected cambiarMovimiento(valor: ValorOpcion): void {
    this.movimiento.set(MOVIMIENTOS.find((movimiento) => movimiento === valor) ?? '');
    this.pagina.set(1);
  }

  protected cambiarArea(valor: ValorOpcion): void {
    this.areaId.set(typeof valor === 'number' ? valor : null);
    this.pagina.set(1);
  }

  protected abrirSituacion(trabajador: TrabajadorResumen): void {
    this.situacion().reiniciar(trabajador);
    this.paraSituacion.set(trabajador);
  }

  protected abrirReingreso(trabajador: TrabajadorResumen): void {
    this.reingreso().reiniciar(trabajador);
    this.paraReingreso.set(trabajador);
  }

  protected alActualizar(detalle: TrabajadorDetalle, mensaje: string): void {
    this.paraSituacion.set(null);
    this.paraReingreso.set(null);
    this.avisos.exito(`${mensaje}: ${nombreCompleto(detalle)}`);
    this.listado.reload();
    this.cambio.emit();
  }

  recargar(): void {
    this.listado.reload();
  }
}
