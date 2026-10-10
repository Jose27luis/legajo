import { ChangeDetectionStrategy, Component, computed, inject, resource, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NewWorkerDialogComponent } from '../../components/new-worker-dialog/new-worker-dialog.component';
import { ReentryDialogComponent } from '../../components/reentry-dialog/reentry-dialog.component';
import { WorkerDirectoryComponent } from '../../components/worker-directory/worker-directory.component';
import { mensajeDeError } from '../../core/errors';
import { fechaCorta, nombreCompleto } from '../../core/labels';
import type { EstadoTrabajador, Movimiento, TrabajadorDetalle, TrabajadorResumen } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { WorkersService } from '../../services/workers.service';

interface Indicador {
  titulo: string;
  valor: number;
  nota: string;
  estado: EstadoTrabajador | '';
  movimiento: Movimiento | '';
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, WorkerDirectoryComponent, NewWorkerDialogComponent, ReentryDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly servicio = inject(WorkersService);
  private readonly router = inject(Router);
  private readonly avisos = inject(ToastService);
  protected readonly sesion = inject(SessionService);

  private readonly nuevoIngreso = viewChild.required(NewWorkerDialogComponent);
  private readonly reingreso = viewChild.required(ReentryDialogComponent);
  private readonly directorio = viewChild.required(WorkerDirectoryComponent);

  protected readonly nombreCompleto = nombreCompleto;
  protected readonly fechaCorta = fechaCorta;
  protected readonly resumen = resource({ loader: () => this.servicio.resumen() });
  protected readonly errorResumen = computed(() => {
    const error = this.resumen.error();
    return error === undefined ? null : mensajeDeError(error);
  });
  protected readonly indicadores = computed<Indicador[]>(() => {
    const datos = this.resumen.value();
    return [
      { titulo: 'Total de trabajadores', valor: datos?.total ?? 0, nota: 'Registros únicos', estado: '', movimiento: '' },
      { titulo: 'Personal activo', valor: datos?.activos ?? 0, nota: 'Laboran actualmente', estado: 'ACTIVO', movimiento: '' },
      { titulo: 'Personal cesado', valor: datos?.cesados ?? 0, nota: 'Ya no laboran', estado: 'CESADO', movimiento: '' },
      { titulo: 'Personal rotado', valor: datos?.rotados ?? 0, nota: 'Incluidos en activos', estado: 'ACTIVO', movimiento: 'ROTACION' },
      { titulo: 'Personal destacado', valor: datos?.destacados ?? 0, nota: 'Incluidos en activos', estado: 'ACTIVO', movimiento: 'DESTAQUE' },
    ];
  });

  protected readonly nuevoAbierto = signal(false);
  protected readonly paraReingreso = signal<TrabajadorResumen | null>(null);

  protected filtrar(indicador: Indicador): void {
    const parametros: Record<string, string> = {};
    if (indicador.estado !== '') {
      parametros['estado'] = indicador.estado;
    }
    if (indicador.movimiento !== '') {
      parametros['movimiento'] = indicador.movimiento;
    }
    void this.router.navigate(['/workers'], { queryParams: parametros });
  }

  protected abrirNuevo(): void {
    this.nuevoIngreso().reiniciar();
    this.nuevoAbierto.set(true);
  }

  protected alCrear(trabajador: TrabajadorDetalle): void {
    this.nuevoAbierto.set(false);
    this.avisos.exito(`Ingreso registrado: ${nombreCompleto(trabajador)}`);
    void this.router.navigate(['/workers', trabajador.id]);
  }

  protected irAReingreso(trabajador: TrabajadorResumen): void {
    this.nuevoAbierto.set(false);
    this.reingreso().reiniciar(trabajador);
    this.paraReingreso.set(trabajador);
  }

  protected alReingresar(trabajador: TrabajadorDetalle): void {
    this.paraReingreso.set(null);
    this.avisos.exito(`Reingreso registrado: ${nombreCompleto(trabajador)}`);
    this.refrescar();
  }

  protected refrescar(): void {
    this.resumen.reload();
    this.directorio().recargar();
  }
}
