import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RequirementsTableComponent } from '../../../components/requirements-table/requirements-table.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import { SessionService } from '../../../core/session.service';
import { ReportsService } from '../../../services/reports.service';
import { WorkerContext } from '../worker-context';

@Component({
  selector: 'app-legajo-missing',
  imports: [RequirementsTableComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legajo-missing.component.html',
  styleUrl: './legajo-missing.component.css',
})
export class LegajoMissingComponent {
  private readonly reportes = inject(ReportsService);
  private readonly contexto = inject(WorkerContext);
  protected readonly sesion = inject(SessionService);

  protected readonly faltantes = resource({
    params: () => (this.contexto.id() === '' ? undefined : this.contexto.id()),
    loader: ({ params }) => this.reportes.faltantes(params),
  });

  protected readonly error = computed(() => {
    const error = this.faltantes.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly enlace = computed(() => this.reportes.enlaceFaltantes(this.contexto.id()));
}
