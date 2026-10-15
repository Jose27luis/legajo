import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../../../components/search-select/search-select.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import type { FiltrosAvance, TipoPersonal } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { FilterOptionsService } from '../../../services/filter-options.service';
import { ReportsService } from '../../../services/reports.service';

const VACIOS: FiltrosAvance = { areaId: null, regimenId: null, tipoPersonal: null, estado: null };

const TIPOS_PERSONAL: readonly TipoPersonal[] = ['ADMINISTRATIVO', 'ASISTENCIAL'];

const OPCIONES_TIPO_PERSONAL: readonly OpcionBuscable[] = [
  { valor: null, etiqueta: 'Ambos' },
  { valor: 'ADMINISTRATIVO', etiqueta: 'Administrativo' },
  { valor: 'ASISTENCIAL', etiqueta: 'Asistencial' },
];

const OPCIONES_ESTADO: readonly OpcionBuscable[] = [
  { valor: null, etiqueta: 'Todos' },
  { valor: 'ACTIVO', etiqueta: 'Activos' },
  { valor: 'CESADO', etiqueta: 'Cesados' },
];

@Component({
  selector: 'app-progress-report',
  imports: [SkeletonComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-report.component.html',
  styleUrl: './progress-report.component.css',
})
export class ProgressReportComponent {
  private readonly reportes = inject(ReportsService);
  private readonly opcionesFiltro = inject(FilterOptionsService);
  protected readonly sesion = inject(SessionService);

  protected readonly filtros = signal<FiltrosAvance>({ ...VACIOS });

  protected readonly opciones = resource({ loader: () => this.opcionesFiltro.cargar() });
  protected readonly reporte = resource({
    params: () => this.filtros(),
    loader: ({ params }) => this.reportes.avance(params),
  });

  protected readonly error = computed(() => {
    const error = this.reporte.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly enlace = computed(() => this.reportes.enlaceAvance(this.filtros()));

  protected readonly opcionesTipoPersonal = OPCIONES_TIPO_PERSONAL;
  protected readonly opcionesEstado = OPCIONES_ESTADO;
  protected readonly opcionesArea = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todas las áreas' },
    ...(this.opciones.hasValue() ? this.opciones.value().areas : []).map((area) => ({ valor: area.id, etiqueta: area.nombre })),
  ]);
  protected readonly opcionesRegimen = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todos los regímenes' },
    ...(this.opciones.hasValue() ? this.opciones.value().regimenes : []).map((regimen) => ({
      valor: regimen.id,
      etiqueta: regimen.nombre,
    })),
  ]);

  protected cambiarArea(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, areaId: typeof valor === 'number' ? valor : null }));
  }

  protected cambiarRegimen(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, regimenId: typeof valor === 'number' ? valor : null }));
  }

  protected cambiarTipoPersonal(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, tipoPersonal: TIPOS_PERSONAL.find((tipo) => tipo === valor) ?? null }));
  }

  protected cambiarEstado(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, estado: valor === 'ACTIVO' || valor === 'CESADO' ? valor : null }));
  }
}
