import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../../components/search-select/search-select.component';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../core/errors';
import { fechaCorta, numeroSeccion } from '../../core/labels';
import { SessionService } from '../../core/session.service';
import { ReportsService } from '../../services/reports.service';

const PLAZOS: readonly number[] = [30, 60, 90, 180];

const OPCIONES_PLAZO: readonly OpcionBuscable[] = PLAZOS.map((plazo) => ({ valor: plazo, etiqueta: `${plazo} días` }));

@Component({
  selector: 'app-alerts',
  imports: [RouterLink, SkeletonComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.css',
})
export class AlertsComponent {
  private readonly reportes = inject(ReportsService);
  protected readonly sesion = inject(SessionService);

  protected readonly opcionesPlazo = OPCIONES_PLAZO;
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

  protected cambiarDias(valor: ValorOpcion): void {
    this.dias.set(PLAZOS.find((plazo) => plazo === valor) ?? 60);
  }
}
