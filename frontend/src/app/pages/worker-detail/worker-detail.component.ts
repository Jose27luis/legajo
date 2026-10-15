import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../core/errors';
import { WorkerContext } from './worker-context';

@Component({
  selector: 'app-worker-detail',
  imports: [RouterOutlet, SkeletonComponent],
  providers: [WorkerContext],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './worker-detail.component.html',
  styleUrl: './worker-detail.component.css',
})
export class WorkerDetailComponent {
  protected readonly contexto = inject(WorkerContext);

  protected readonly detalle = this.contexto.detalle;

  protected readonly errorDetalle = computed(() => {
    const error = this.detalle.error();
    return error === undefined ? null : mensajeDeError(error);
  });
}
