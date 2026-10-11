import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RequirementsTableComponent } from '../../../components/requirements-table/requirements-table.component';
import { WorkerPickerComponent } from '../../../components/worker-picker/worker-picker.component';
import { mensajeDeError } from '../../../core/errors';
import type { TrabajadorLote } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { ReportsService } from '../../../services/reports.service';

@Component({
  selector: 'app-missing-report',
  imports: [WorkerPickerComponent, RequirementsTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './missing-report.component.html',
  styleUrl: './missing-report.component.css',
})
export class MissingReportComponent {
  private readonly reportes = inject(ReportsService);
  protected readonly sesion = inject(SessionService);

  protected readonly elegido = signal<TrabajadorLote | null>(null);

  protected readonly reporte = resource({
    params: () => this.elegido()?.id,
    loader: ({ params }) => this.reportes.faltantes(params),
  });

  protected readonly error = computed(() => {
    const error = this.reporte.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly enlace = computed(() => {
    const trabajador = this.elegido();
    return trabajador === null ? '' : this.reportes.enlaceFaltantes(trabajador.id);
  });
}
