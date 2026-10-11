import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '../../../core/errors';
import { numeroDe } from '../../../core/inputs';
import { diasRestantes, fechaCorta, numeroSeccion } from '../../../core/labels';
import type { FiltrosVencimientos, TipoDocumento } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { FilterOptionsService } from '../../../services/filter-options.service';
import { ReportsService } from '../../../services/reports.service';

const DIAS = [30, 60, 90, 180, 365] as const;

@Component({
  selector: 'app-expiring-report',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expiring-report.component.html',
  styleUrl: './expiring-report.component.css',
})
export class ExpiringReportComponent {
  private readonly reportes = inject(ReportsService);
  private readonly opcionesFiltro = inject(FilterOptionsService);
  protected readonly sesion = inject(SessionService);

  protected readonly opcionesDias = DIAS;
  protected readonly diasRestantes = diasRestantes;
  protected readonly numeroSeccion = numeroSeccion;
  protected readonly fechaCorta = fechaCorta;

  protected readonly filtros = signal<FiltrosVencimientos>({ dias: 30, areaId: null, tipoDocumentoId: null });

  protected readonly opciones = resource({ loader: () => this.opcionesFiltro.cargar() });
  protected readonly reporte = resource({
    params: () => this.filtros(),
    loader: ({ params }) => this.reportes.vencimientos(params),
  });

  protected readonly error = computed(() => {
    const error = this.reporte.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly enlace = computed(() => this.reportes.enlaceVencimientos(this.filtros()));

  protected readonly tipos = computed<TipoDocumento[]>(() => {
    if (!this.opciones.hasValue()) {
      return [];
    }
    return this.opciones
      .value()
      .secciones.flatMap((seccion) => seccion.tipos)
      .filter((tipo) => tipo.tieneVencimiento);
  });

  protected cambiarDias(evento: Event): void {
    const valor = numeroDe(evento);
    this.filtros.update((actual) => ({ ...actual, dias: valor ?? 30 }));
  }

  protected cambiarArea(evento: Event): void {
    this.filtros.update((actual) => ({ ...actual, areaId: numeroDe(evento) }));
  }

  protected cambiarTipo(evento: Event): void {
    this.filtros.update((actual) => ({ ...actual, tipoDocumentoId: numeroDe(evento) }));
  }
}
