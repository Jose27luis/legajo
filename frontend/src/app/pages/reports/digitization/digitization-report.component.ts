import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../../../components/search-select/search-select.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import { valorDe } from '../../../core/inputs';
import { fechaCorta, tamanoLegible } from '../../../core/labels';
import type { FiltrosDigitalizacion } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { ReportsService } from '../../../services/reports.service';

@Component({
  selector: 'app-digitization-report',
  imports: [SkeletonComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './digitization-report.component.html',
  styleUrl: './digitization-report.component.css',
})
export class DigitizationReportComponent {
  private readonly reportes = inject(ReportsService);
  protected readonly sesion = inject(SessionService);

  protected readonly fechaCorta = fechaCorta;
  protected readonly tamanoLegible = tamanoLegible;

  protected readonly filtros = signal<FiltrosDigitalizacion>({ usuarioId: null, desde: '', hasta: '' });

  protected readonly reporte = resource({
    params: () => this.filtros(),
    loader: ({ params }) => this.reportes.digitalizacion(params),
  });

  protected readonly error = computed(() => {
    const error = this.reporte.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly enlace = computed(() => this.reportes.enlaceDigitalizacion(this.filtros()));

  protected readonly opcionesUsuario = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todas las cuentas' },
    ...(this.reporte.hasValue() ? this.reporte.value().usuarios : []).map((usuario) => ({ valor: usuario.id, etiqueta: usuario.nombre })),
  ]);

  protected cambiarUsuario(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, usuarioId: typeof valor === 'string' && valor !== '' ? valor : null }));
  }

  protected cambiarDesde(evento: Event): void {
    this.filtros.update((actual) => ({ ...actual, desde: valorDe(evento) }));
  }

  protected cambiarHasta(evento: Event): void {
    this.filtros.update((actual) => ({ ...actual, hasta: valorDe(evento) }));
  }
}
