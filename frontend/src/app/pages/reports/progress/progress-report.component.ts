import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import { numeroDe, valorDe } from '../../../core/inputs';
import type { EstadoTrabajador, FiltrosAvance, TipoPersonal } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { FilterOptionsService } from '../../../services/filter-options.service';
import { ReportsService } from '../../../services/reports.service';

const VACIOS: FiltrosAvance = { areaId: null, regimenId: null, tipoPersonal: null, estado: null };

@Component({
  selector: 'app-progress-report',
  imports: [SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-report.component.html',
  styleUrl: './progress-report.component.css',
})
export class ProgressReportComponent {
  private readonly reportes = inject(ReportsService);
  private readonly opcionesFiltro = inject(FilterOptionsService);
  protected readonly sesion = inject(SessionService);

  protected readonly filtros = signal<FiltrosAvance>({ ...VACIOS });

  protected readonly opciones = resource({ loader: () => this.opcionesFiltro.cargar() });
  protected readonly reporte = resource({
    params: () => this.filtros(),
    loader: ({ params }) => this.reportes.avance(params),
  });

  protected readonly error = computed(() => {
    const error = this.reporte.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly enlace = computed(() => this.reportes.enlaceAvance(this.filtros()));

  protected cambiarArea(evento: Event): void {
    this.filtros.update((actual) => ({ ...actual, areaId: numeroDe(evento) }));
  }

  protected cambiarRegimen(evento: Event): void {
    this.filtros.update((actual) => ({ ...actual, regimenId: numeroDe(evento) }));
  }

  protected cambiarTipoPersonal(evento: Event): void {
    const valor = valorDe(evento);
    this.filtros.update((actual) => ({ ...actual, tipoPersonal: valor === '' ? null : (valor as TipoPersonal) }));
  }

  protected cambiarEstado(evento: Event): void {
    const valor = valorDe(evento);
    this.filtros.update((actual) => ({ ...actual, estado: valor === '' ? null : (valor as EstadoTrabajador) }));
  }
}
