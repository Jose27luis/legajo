import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '../../../core/errors';
import { marcadoDe, numeroDe, valorDe } from '../../../core/inputs';
import { CLASE_SITUACION, TEXTO_SITUACION, numeroSeccion } from '../../../core/labels';
import type { EstadoTrabajador, FiltrosConsolidado, TipoPersonal } from '../../../core/models';
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

@Component({
  selector: 'app-missing-summary-report',
  imports: [RouterLink],
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

  protected cambiar(campo: 'areaId' | 'regimenId', evento: Event): void {
    this.filtros.update((actual) => ({ ...actual, [campo]: numeroDe(evento) }));
  }

  protected cambiarTipoPersonal(evento: Event): void {
    const valor = valorDe(evento);
    this.filtros.update((actual) => ({ ...actual, tipoPersonal: valor === '' ? null : (valor as TipoPersonal) }));
  }

  protected cambiarEstado(evento: Event): void {
    const valor = valorDe(evento);
    this.filtros.update((actual) => ({ ...actual, estado: valor === '' ? null : (valor as EstadoTrabajador) }));
  }

  protected cambiarSoloIncompletos(evento: Event): void {
    const marcado = marcadoDe(evento);
    this.filtros.update((actual) => ({ ...actual, soloIncompletos: marcado }));
  }

  protected limpiar(): void {
    this.filtros.set({ ...VACIOS });
  }
}
