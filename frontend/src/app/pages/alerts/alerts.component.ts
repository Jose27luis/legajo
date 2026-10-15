import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../core/errors';
import { numeroDe } from '../../core/inputs';
import { fechaCorta, numeroSeccion } from '../../core/labels';
import { SessionService } from '../../core/session.service';
import { ReportsService } from '../../services/reports.service';

const PLAZOS = [30, 60, 90, 180] as const;

@Component({
  selector: 'app-alerts',
  imports: [RouterLink, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.css',
})
export class AlertsComponent {
  private readonly reportes = inject(ReportsService);
  protected readonly sesion = inject(SessionService);

  protected readonly plazos = PLAZOS;
  protected readonly fechaCorta = fechaCorta;
  protected readonly numeroSeccion = numeroSeccion;
  protected readonly dias = signal(60);

  protected readonly reporte = resource({
    params: () => ({ dias: this.dias(), areaId: null, tipoDocumentoId: null }),
    loader: ({ params }) => this.reportes.vencimientos(params),
  });
  protected readonly error = computed(() => {
    const error = this.reporte.error();
    return error === undefined ? null : mensajeDeError(error);
  });
  protected readonly enlace = computed(() => this.reportes.enlaceVencimientos({ dias: this.dias(), areaId: null, tipoDocumentoId: null }));

  protected cambiarDias(evento: Event): void {
    this.dias.set(numeroDe(evento) ?? 60);
  }
}
