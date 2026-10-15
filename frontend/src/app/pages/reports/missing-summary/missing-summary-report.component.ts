import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../../../components/search-select/search-select.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import { marcadoDe } from '../../../core/inputs';
import { CLASE_SITUACION, TEXTO_SITUACION, numeroSeccion } from '../../../core/labels';
import type { FiltrosConsolidado, TipoPersonal } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { FilterOptionsService } from '../../../services/filter-options.service';
import { ReportsService } from '../../../services/reports.service';

const VACIOS: FiltrosConsolidado = {
  areaId: null,
  regimenId: null,
  tipoPersonal: null,
  estado: null,
  soloIncompletos: false,
};

const TIPOS_PERSONAL: readonly TipoPersonal[] = ['ADMINISTRATIVO', 'ASISTENCIAL'];

const OPCIONES_TIPO_PERSONAL: readonly OpcionBuscable[] = [
  { valor: null, etiqueta: 'Ambos' },
  { valor: 'ADMINISTRATIVO', etiqueta: 'Administrativo' },
  { valor: 'ASISTENCIAL', etiqueta: 'Asistencial' },
];

const OPCIONES_ESTADO: readonly OpcionBuscable[] = [
  { valor: null, etiqueta: 'Todos' },
  { valor: 'ACTIVO', etiqueta: 'Activos' },
  { valor: 'CESADO', etiqueta: 'Cesados' },
];

@Component({
  selector: 'app-missing-summary-report',
  imports: [RouterLink, SkeletonComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './missing-summary-report.component.html',
  styleUrl: './missing-summary-report.component.css',
})
export class MissingSummaryReportComponent {
  private readonly reportes = inject(ReportsService);
  private readonly opcionesFiltro = inject(FilterOptionsService);
  protected readonly sesion = inject(SessionService);

  protected readonly textoSituacion = TEXTO_SITUACION;
  protected readonly claseSituacion = CLASE_SITUACION;
  protected readonly numeroSeccion = numeroSeccion;

  protected readonly filtros = signal<FiltrosConsolidado>({ ...VACIOS });
  protected readonly pagina = linkedSignal<FiltrosConsolidado, number>({ source: this.filtros, computation: () => 1 });

  protected readonly opciones = resource({ loader: () => this.opcionesFiltro.cargar() });
  protected readonly reporte = resource({
    params: () => ({ filtros: this.filtros(), pagina: this.pagina() }),
    loader: ({ params }) => this.reportes.consolidado(params.filtros, params.pagina),
  });

  protected readonly error = computed(() => {
    const error = this.reporte.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly enlace = computed(() => this.reportes.enlaceConsolidado(this.filtros()));
  protected readonly columnas = computed(() => (this.reporte.hasValue() ? this.reporte.value().columnas.length + 4 : 5));
  protected readonly ultimaPagina = computed(() => {
    if (!this.reporte.hasValue()) {
      return 1;
    }
    const reporte = this.reporte.value();
    return Math.max(1, Math.ceil(reporte.total / reporte.porPagina));
  });

  protected readonly opcionesTipoPersonal = OPCIONES_TIPO_PERSONAL;
  protected readonly opcionesEstado = OPCIONES_ESTADO;
  protected readonly opcionesArea = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todas las áreas' },
    ...(this.opciones.hasValue() ? this.opciones.value().areas : []).map((area) => ({ valor: area.id, etiqueta: area.nombre })),
  ]);
  protected readonly opcionesRegimen = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todos los regímenes' },
    ...(this.opciones.hasValue() ? this.opciones.value().regimenes : []).map((regimen) => ({
      valor: regimen.id,
      etiqueta: regimen.nombre,
    })),
  ]);

  protected cambiar(campo: 'areaId' | 'regimenId', valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, [campo]: typeof valor === 'number' ? valor : null }));
  }

  protected cambiarTipoPersonal(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, tipoPersonal: TIPOS_PERSONAL.find((tipo) => tipo === valor) ?? null }));
  }

  protected cambiarEstado(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, estado: valor === 'ACTIVO' || valor === 'CESADO' ? valor : null }));
  }

  protected cambiarSoloIncompletos(evento: Event): void {
    const marcado = marcadoDe(evento);
    this.filtros.update((actual) => ({ ...actual, soloIncompletos: marcado }));
  }

  protected limpiar(): void {
    this.filtros.set({ ...VACIOS });
  }
}
