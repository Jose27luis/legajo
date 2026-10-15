import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../../../components/search-select/search-select.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import { diasRestantes, fechaCorta, numeroSeccion } from '../../../core/labels';
import type { FiltrosVencimientos } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { FilterOptionsService } from '../../../services/filter-options.service';
import { ReportsService } from '../../../services/reports.service';

const OPCIONES_DIAS: readonly OpcionBuscable[] = [30, 60, 90, 180, 365].map((dias) => ({ valor: dias, etiqueta: `Próximos ${dias} días` }));

@Component({
  selector: 'app-expiring-report',
  imports: [RouterLink, SkeletonComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expiring-report.component.html',
  styleUrl: './expiring-report.component.css',
})
export class ExpiringReportComponent {
  private readonly reportes = inject(ReportsService);
  private readonly opcionesFiltro = inject(FilterOptionsService);
  protected readonly sesion = inject(SessionService);

  protected readonly opcionesDias = OPCIONES_DIAS;
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

  protected readonly opcionesArea = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todas las áreas' },
    ...(this.opciones.hasValue() ? this.opciones.value().areas : []).map((area) => ({ valor: area.id, etiqueta: area.nombre })),
  ]);

  protected readonly opcionesTipo = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todos los que vencen' },
    ...(this.opciones.hasValue() ? this.opciones.value().secciones : [])
      .flatMap((seccion) => seccion.tipos)
      .filter((tipo) => tipo.tieneVencimiento)
      .map((tipo) => ({ valor: tipo.id, etiqueta: `${tipo.codigo} ${tipo.nombre}` })),
  ]);

  protected cambiarDias(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, dias: typeof valor === 'number' ? valor : 30 }));
  }

  protected cambiarArea(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, areaId: typeof valor === 'number' ? valor : null }));
  }

  protected cambiarTipo(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, tipoDocumentoId: typeof valor === 'number' ? valor : null }));
  }
}
