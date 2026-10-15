import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, resource, signal } from '@angular/core';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../core/errors';
import { fechaHora } from '../../core/format';
import { tamanoLegible } from '../../core/labels';
import type { EjecucionRespaldo, EstadoRespaldo } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { BackupsService } from '../../services/backups.service';

const INTERVALO_MS = 10000;

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
  imports: [SkeletonComponent],
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
