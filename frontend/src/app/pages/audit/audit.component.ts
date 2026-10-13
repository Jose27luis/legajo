import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuditLogComponent } from '../../components/audit-log/audit-log.component';

@Component({
  selector: 'app-audit',
  imports: [AuditLogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.css',
})
export class AuditComponent {}
