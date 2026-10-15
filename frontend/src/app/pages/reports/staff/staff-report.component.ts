import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import { numeroDe, valorDe } from '../../../core/inputs';
import { TEXTO_ESTADO, TEXTO_TIPO_PERSONAL, fechaCorta } from '../../../core/labels';
import type { EstadoTrabajador, FiltrosReportePersonal, TipoPersonal } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { FilterOptionsService } from '../../../services/filter-options.service';
import { ReportsService } from '../../../services/reports.service';

const VACIOS: FiltrosReportePersonal = {
  areaId: null,
  regimenId: null,
  tipoPersonal: null,
  estado: null,
  cargoId: null,
  ingresoDesde: '',
  ingresoHasta: '',
};

@Component({
  selector: 'app-staff-report',
  imports: [RouterLink, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff-report.component.html',
  styleUrl: './staff-report.component.css',
})
export class StaffReportComponent {
  private readonly reportes = inject(ReportsService);
  private readonly opcionesFiltro = inject(FilterOptionsService);
  protected readonly sesion = inject(SessionService);

  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly textoTipoPersonal = TEXTO_TIPO_PERSONAL;
  protected readonly fechaCorta = fechaCorta;

  protected readonly filtros = signal<FiltrosReportePersonal>({ ...VACIOS });
  protected readonly pagina = linkedSignal<FiltrosReportePersonal, number>({ source: this.filtros, computation: () => 1 });

  protected readonly opciones = resource({ loader: () => this.opcionesFiltro.cargar() });
  protected readonly reporte = resource({
    params: () => ({ filtros: this.filtros(), pagina: this.pagina() }),
    loader: ({ params }) => this.reportes.personal(params.filtros, params.pagina),
  });

  protected readonly error = computed(() => {
    const error = this.reporte.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly enlace = computed(() => this.reportes.enlacePersonal(this.filtros()));
  protected readonly ultimaPagina = computed(() => {
    if (!this.reporte.hasValue()) {
      return 1;
    }
    const reporte = this.reporte.value();
    return Math.max(1, Math.ceil(reporte.total / reporte.porPagina));
  });

  protected cambiar(campo: keyof FiltrosReportePersonal, evento: Event): void {
    const valor = valorDe(evento);
    if (campo === 'ingresoDesde' || campo === 'ingresoHasta') {
      this.filtros.update((actual) => ({ ...actual, [campo]: valor }));
      return;
    }
    if (campo === 'tipoPersonal') {
      this.filtros.update((actual) => ({ ...actual, tipoPersonal: valor === '' ? null : (valor as TipoPersonal) }));
      return;
    }
    if (campo === 'estado') {
      this.filtros.update((actual) => ({ ...actual, estado: valor === '' ? null : (valor as EstadoTrabajador) }));
      return;
    }
    this.filtros.update((actual) => ({ ...actual, [campo]: numeroDe(evento) }));
  }

  protected limpiar(): void {
    this.filtros.set({ ...VACIOS });
  }
}
