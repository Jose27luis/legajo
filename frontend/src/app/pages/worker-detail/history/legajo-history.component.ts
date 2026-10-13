import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuditLogComponent } from '../../../components/audit-log/audit-log.component';
import { WorkerContext } from '../worker-context';

@Component({
  selector: 'app-legajo-history',
  imports: [AuditLogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legajo-history.component.html',
  styleUrl: './legajo-history.component.css',
})
export class LegajoHistoryComponent {
  protected readonly contexto = inject(WorkerContext);
}
