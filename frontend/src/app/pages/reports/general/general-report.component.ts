import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DossierDialogComponent, type TrabajadorExpediente } from '../../../components/dossier-dialog/dossier-dialog.component';
import { WorkerPickerComponent } from '../../../components/worker-picker/worker-picker.component';
import { mensajeDeError } from '../../../core/errors';
import { valorDe } from '../../../core/inputs';
import { nombreCompleto } from '../../../core/labels';
import type { FiltrosReporteGeneral, TipoReporteGeneral, TrabajadorLote } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { ToastService } from '../../../core/toast.service';
import { FilterOptionsService } from '../../../services/filter-options.service';
import { ReportsService } from '../../../services/reports.service';
import { WorkersService } from '../../../services/workers.service';

const TIPOS: readonly { valor: TipoReporteGeneral; texto: string }[] = [
  { valor: 'general', texto: 'Padrón general de trabajadores' },
  { valor: 'situacion', texto: 'Personal por situación laboral' },
  { valor: 'regimen', texto: 'Personal por régimen' },
  { valor: 'documentos', texto: 'Inventario de documentos' },
  { valor: 'secciones', texto: 'Documentos vigentes por sección' },
  { valor: 'estadisticas', texto: 'Estadísticas del personal' },
];

const VACIOS: FiltrosReporteGeneral = {
  tipo: 'general',
  estado: '',
  areaId: null,
  regimenId: null,
  busqueda: '',
  ingresoDesde: '',
  ingresoHasta: '',
};

const ESPERA_MS = 350;
const DNI = /^\d{8}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const escapar = (valor: string | number | null): string =>
  String(valor ?? '').replace(
    /[&<>"']/g,
    (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter] ?? caracter,
  );

@Component({
  selector: 'app-general-report',
  imports: [RouterLink, WorkerPickerComponent, DossierDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './general-report.component.html',
  styleUrl: './general-report.component.css',
})
export class GeneralReportComponent {
  private readonly reportes = inject(ReportsService);
  private readonly opcionesFiltro = inject(FilterOptionsService);
  private readonly trabajadores = inject(WorkersService);
  private readonly avisos = inject(ToastService);
  protected readonly sesion = inject(SessionService);

  protected readonly tipos = TIPOS;
  protected readonly filtros = signal<FiltrosReporteGeneral>({ ...VACIOS });
  protected readonly opciones = resource({ loader: () => this.opcionesFiltro.cargar() });
  protected readonly reporte = resource({
    params: () => this.filtros(),
    loader: ({ params }) => this.reportes.general(params),
  });
  protected readonly error = computed(() => {
    const error = this.reporte.error();
    return error === undefined ? null : mensajeDeError(error);
  });
  protected readonly enlace = computed(() => this.reportes.enlaceGeneral(this.filtros()));
  protected readonly nombreTipo = computed(() => TIPOS.find((tipo) => tipo.valor === this.filtros().tipo)?.texto ?? '');
  protected readonly imprimiendo = signal(false);

  protected readonly elegido = signal<TrabajadorLote | null>(null);
  protected readonly paraExpediente = signal<TrabajadorExpediente | null>(null);
  protected readonly cargandoExpediente = signal(false);
  private elegidoDesdeBusqueda = false;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected cambiar(campo: keyof FiltrosReporteGeneral, evento: Event): void {
    const valor = valorDe(evento);
    this.filtros.update((actual) => {
      if (campo === 'areaId' || campo === 'regimenId') {
        return { ...actual, [campo]: valor === '' ? null : Number(valor) };
      }
      if (campo === 'tipo') {
        return { ...actual, tipo: TIPOS.find((tipo) => tipo.valor === valor)?.valor ?? 'general' };
      }
      if (campo === 'estado') {
        return { ...actual, estado: valor === 'ACTIVO' || valor === 'CESADO' ? valor : '' };
      }
      return { ...actual, [campo]: valor.trim() };
    });
  }

  protected mostrar(celda: string | number | null): string | number {
    if (celda === null || celda === '') {
      return '—';
    }
    return typeof celda === 'string' && FECHA.test(celda) ? `${celda.slice(8, 10)}/${celda.slice(5, 7)}/${celda.slice(0, 4)}` : celda;
  }

  protected escribirBusqueda(evento: Event): void {
    const valor = valorDe(evento).trim();
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.aplicarBusqueda(valor), ESPERA_MS);
  }

  private async aplicarBusqueda(valor: string): Promise<void> {
    this.filtros.update((actual) => (actual.busqueda === valor ? actual : { ...actual, busqueda: valor }));
    if (this.elegidoDesdeBusqueda && this.elegido()?.numeroDoc !== valor) {
      this.elegidoDesdeBusqueda = false;
      this.elegido.set(null);
    }
    if (!DNI.test(valor) || this.elegido()?.numeroDoc === valor) {
      return;
    }
    const encontrado = await this.trabajadores.buscarDocumento('DNI', valor).catch(() => null);
    if (encontrado?.trabajador && this.filtros().busqueda === valor) {
      const trabajador = encontrado.trabajador;
      this.elegidoDesdeBusqueda = true;
      this.elegido.set({ id: trabajador.id, numeroDoc: trabajador.numeroDoc, nombre: nombreCompleto(trabajador) });
    }
  }

  protected limpiar(): void {
    clearTimeout(this.temporizador);
    this.filtros.set({ ...VACIOS });
    if (this.elegidoDesdeBusqueda) {
      this.elegidoDesdeBusqueda = false;
      this.elegido.set(null);
    }
  }

  protected async abrirExpediente(): Promise<void> {
    const elegido = this.elegido();
    if (elegido === null) {
      this.avisos.error('Elige primero un trabajador.');
      return;
    }
    this.cargandoExpediente.set(true);
    try {
      const detalle = await this.trabajadores.obtener(elegido.id);
      this.paraExpediente.set({
        id: detalle.id,
        nombre: nombreCompleto(detalle),
        tipoDocIdentidad: detalle.tipoDocIdentidad,
        numeroDoc: detalle.numeroDoc,
        regimen: detalle.vinculo?.regimen.nombre ?? null,
        estado: detalle.estado,
      });
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.cargandoExpediente.set(false);
    }
  }

  protected async imprimir(): Promise<void> {
    const ventana = window.open('', '_blank');
    if (ventana === null) {
      this.avisos.error('Habilita las ventanas emergentes para imprimir el reporte.');
      return;
    }
    this.imprimiendo.set(true);
    try {
      const datos = await this.reportes.general(this.filtros(), true);
      const fecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' }).format(
        new Date(),
      );
      const cabecera = datos.columnas.map((columna) => `<th>${escapar(columna)}</th>`).join('');
      const filas = datos.filas.map((fila) => `<tr>${fila.map((celda) => `<td>${escapar(celda)}</td>`).join('')}</tr>`).join('');
      ventana.document.write(
        `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de legajos</title><style>` +
          'body{font:12px Arial,sans-serif;margin:30px;color:#253c50}h1{font-size:18px;color:#173d5b;margin:0 0 4px}' +
          'p{margin:0 0 14px;color:#4b6275}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ced9e1;padding:6px;text-align:left;overflow-wrap:anywhere}' +
          'th{background:#eaf1f6}@page{size:A4 landscape;margin:14mm}' +
          `</style></head><body><h1>DIRESA Madre de Dios · Área de Legajos</h1><p>${escapar(this.nombreTipo())} · ${escapar(fecha)} · ${datos.total} registros</p>` +
          `<table><thead><tr>${cabecera}</tr></thead><tbody>${filas}</tbody></table></body></html>`,
      );
      ventana.document.close();
      ventana.focus();
      ventana.print();
    } catch (error: unknown) {
      ventana.close();
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.imprimiendo.set(false);
    }
  }
}
