import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, resource, signal } from '@angular/core';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../core/errors';
import { fechaHora } from '../../core/format';
import { hoy, tamanoLegible } from '../../core/labels';
import type { EjecucionRespaldo, EstadoRespaldo } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { BackupsService } from '../../services/backups.service';

const INTERVALO_MS = 10000;
const DIAS_POR_DEFECTO = 7;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

function restarDias(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - dias);
  return base.toISOString().slice(0, 10);
}

export const TEXTO_ESTADO_RESPALDO: Record<EstadoRespaldo, string> = {
  EN_CURSO: 'En curso',
  CORRECTO: 'Correcta',
  ERROR: 'Con error',
};

export const CLASE_ESTADO_RESPALDO: Record<EstadoRespaldo, string> = {
  EN_CURSO: 'azul',
  CORRECTO: 'verde',
  ERROR: 'roja',
};

@Component({
  selector: 'app-backups',
  imports: [SkeletonComponent, DatePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './backups.component.html',
  styleUrl: './backups.component.css',
})
export class BackupsComponent {
  private readonly servicio = inject(BackupsService);
  private readonly avisos = inject(ToastService);

  protected readonly fechaHora = fechaHora;
  protected readonly tamanoLegible = tamanoLegible;
  protected readonly textoEstado = TEXTO_ESTADO_RESPALDO;
  protected readonly claseEstado = CLASE_ESTADO_RESPALDO;

  protected readonly pagina = signal(1);
  protected readonly lanzando = signal(false);

  protected readonly panel = resource({
    params: () => this.pagina(),
    loader: ({ params }) => this.servicio.panel(params),
  });

  protected readonly error = computed(() => {
    const error = this.panel.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly ultimaPagina = computed(() => {
    if (!this.panel.hasValue()) {
      return 1;
    }
    const datos = this.panel.value();
    return Math.max(1, Math.ceil(datos.total / datos.porPagina));
  });

  protected readonly hoy = hoy();
  protected readonly desde = signal(restarDias(this.hoy, DIAS_POR_DEFECTO - 1));
  protected readonly hasta = signal(this.hoy);
  protected readonly rangoValido = computed(
    () => FECHA_ISO.test(this.desde()) && FECHA_ISO.test(this.hasta()) && this.desde() <= this.hasta() && this.hasta() <= this.hoy,
  );
  protected readonly copiaMasAntigua = computed(() => {
    const fechas = this.panel.hasValue() ? (this.panel.value().repositorio?.snapshots ?? []).map((copia) => copia.fecha) : [];
    return fechas.length === 0 ? null : formatoDia.format(new Date(fechas.reduce((menor, fecha) => (fecha < menor ? fecha : menor))));
  });
  protected readonly copiasEnRango = computed(() => {
    if (!this.rangoValido() || !this.panel.hasValue()) {
      return 0;
    }
    const enRango = (this.panel.value().repositorio?.snapshots ?? []).filter((copia) => {
      const dia = formatoDia.format(new Date(copia.fecha));
      return copia.ejecucionId !== null && this.desde() <= dia && dia <= this.hasta();
    });
    const conBase = new Set(enRango.filter((copia) => copia.contenido === 'bd').map((copia) => copia.ejecucionId));
    return new Set(
      enRango.filter((copia) => copia.contenido === 'archivos' && conBase.has(copia.ejecucionId)).map((copia) => copia.ejecucionId),
    ).size;
  });
  protected readonly enlaceDescarga = computed(() => this.servicio.enlaceDescarga(this.desde(), this.hasta()));

  constructor() {
    const temporizador = setInterval(() => {
      if (this.panel.hasValue() && this.panel.value().pendiente && !this.panel.isLoading()) {
        this.panel.reload();
      }
    }, INTERVALO_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(temporizador));
  }

  protected duracion(ejecucion: EjecucionRespaldo): string {
    if (ejecucion.fin === null) {
      return 'En curso';
    }
    const segundos = Math.max(1, Math.round((Date.parse(ejecucion.fin) - Date.parse(ejecucion.inicio)) / 1000));
    return segundos < 60 ? `${segundos} s` : `${Math.floor(segundos / 60)} min ${segundos % 60} s`;
  }

  protected corto(id: string | null): string {
    return id === null ? 'Sin copia' : id.slice(0, 8);
  }

  protected async lanzar(): Promise<void> {
    this.lanzando.set(true);
    try {
      await this.servicio.lanzar();
      this.avisos.exito('Copia de seguridad en marcha');
      this.panel.reload();
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.lanzando.set(false);
    }
  }
}
