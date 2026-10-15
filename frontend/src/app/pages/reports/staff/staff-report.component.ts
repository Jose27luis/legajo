import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../../../components/search-select/search-select.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import { valorDe } from '../../../core/inputs';
import { TEXTO_ESTADO, TEXTO_TIPO_PERSONAL, fechaCorta } from '../../../core/labels';
import type { FiltrosReportePersonal, TipoPersonal } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { FilterOptionsService } from '../../../services/filter-options.service';
import { ReportsService } from '../../../services/reports.service';

const VACIOS: FiltrosReportePersonal = {
  areaId: null,
  regimenId: null,
  tipoPersonal: null,
  estado: null,
  cargoId: null,
  ingresoDesde: '',
  ingresoHasta: '',
};

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
  selector: 'app-staff-report',
  imports: [RouterLink, SkeletonComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff-report.component.html',
  styleUrl: './staff-report.component.css',
})
export class StaffReportComponent {
  private readonly reportes = inject(ReportsService);
  private readonly opcionesFiltro = inject(FilterOptionsService);
  protected readonly sesion = inject(SessionService);

  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly textoTipoPersonal = TEXTO_TIPO_PERSONAL;
  protected readonly fechaCorta = fechaCorta;

  protected readonly filtros = signal<FiltrosReportePersonal>({ ...VACIOS });
  protected readonly pagina = linkedSignal<FiltrosReportePersonal, number>({ source: this.filtros, computation: () => 1 });

  protected readonly opciones = resource({ loader: () => this.opcionesFiltro.cargar() });
  protected readonly reporte = resource({
    params: () => ({ filtros: this.filtros(), pagina: this.pagina() }),
    loader: ({ params }) => this.reportes.personal(params.filtros, params.pagina),
  });

  protected readonly error = computed(() => {
    const error = this.reporte.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly enlace = computed(() => this.reportes.enlacePersonal(this.filtros()));
  protected readonly ultimaPagina = computed(() => {
    if (!this.reporte.hasValue()) {
      return 1;
    }
    const reporte = this.reporte.value();
    return Math.max(1, Math.ceil(reporte.total / reporte.porPagina));
  });

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
  protected readonly opcionesCargo = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todos los cargos' },
    ...(this.opciones.hasValue() ? this.opciones.value().cargos : []).map((cargo) => ({ valor: cargo.id, etiqueta: cargo.nombre })),
  ]);

  protected cambiar(campo: 'ingresoDesde' | 'ingresoHasta', evento: Event): void {
    const valor = valorDe(evento);
    this.filtros.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected cambiarNumero(campo: 'areaId' | 'regimenId' | 'cargoId', valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, [campo]: typeof valor === 'number' ? valor : null }));
  }

  protected cambiarTipoPersonal(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, tipoPersonal: TIPOS_PERSONAL.find((tipo) => tipo === valor) ?? null }));
  }

  protected cambiarEstado(valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, estado: valor === 'ACTIVO' || valor === 'CESADO' ? valor : null }));
  }

  protected limpiar(): void {
    this.filtros.set({ ...VACIOS });
  }
}
