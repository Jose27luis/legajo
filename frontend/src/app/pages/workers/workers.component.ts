import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NewWorkerDialogComponent } from '../../components/new-worker-dialog/new-worker-dialog.component';
import { ReentryDialogComponent } from '../../components/reentry-dialog/reentry-dialog.component';
import { WorkerDirectoryComponent } from '../../components/worker-directory/worker-directory.component';
import { MOVIMIENTOS, nombreCompleto } from '../../core/labels';
import type { EstadoTrabajador, Movimiento, TrabajadorDetalle, TrabajadorResumen } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-workers',
  imports: [WorkerDirectoryComponent, NewWorkerDialogComponent, ReentryDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workers.component.html',
  styleUrl: './workers.component.css',
})
export class WorkersComponent {
  private readonly router = inject(Router);
  private readonly avisos = inject(ToastService);
  protected readonly sesion = inject(SessionService);

  readonly estado = input<string>();
  readonly movimiento = input<string>();
  readonly nuevo = input<string>();

  private readonly nuevoIngreso = viewChild.required(NewWorkerDialogComponent);
  private readonly reingreso = viewChild.required(ReentryDialogComponent);
  private readonly directorio = viewChild.required(WorkerDirectoryComponent);

  protected readonly estadoInicial = computed<EstadoTrabajador | ''>(() => {
    const valor = this.estado();
    return valor === 'ACTIVO' || valor === 'CESADO' ? valor : '';
  });
  protected readonly movimientoInicial = computed<Movimiento | ''>(
    () => MOVIMIENTOS.find((movimiento) => movimiento === this.movimiento()) ?? '',
  );
  protected readonly nuevoAbierto = signal(false);
  protected readonly paraReingreso = signal<TrabajadorResumen | null>(null);

  constructor() {
    effect(() => {
      if (this.nuevo() === '1' && this.sesion.tiene('personal.editar') && !untracked(this.nuevoAbierto)) {
        this.abrirNuevo();
        void this.router.navigate([], { queryParams: { nuevo: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
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
    this.directorio().recargar();
  }
}
