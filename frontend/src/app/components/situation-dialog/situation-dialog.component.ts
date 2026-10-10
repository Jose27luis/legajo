import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DialogComponent } from '../dialog/dialog.component';
import { mensajeDeError } from '../../core/errors';
import { MOTIVOS_CESE, MOVIMIENTOS, TEXTO_MOTIVO_CESE, TEXTO_MOVIMIENTO, hoy, nombreCompleto } from '../../core/labels';
import type { MotivoCese, Movimiento, TrabajadorDetalle, TrabajadorResumen } from '../../core/models';
import { WorkersService } from '../../services/workers.service';

type Accion = 'movimiento' | 'cese';

@Component({
  selector: 'app-situation-dialog',
  imports: [ReactiveFormsModule, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './situation-dialog.component.html',
  styleUrl: './situation-dialog.component.css',
})
export class SituationDialogComponent {
  private readonly servicio = inject(WorkersService);

  readonly trabajador = input.required<TrabajadorResumen | null>();
  readonly cerrar = output();
  readonly actualizado = output<TrabajadorDetalle>();

  protected readonly movimientos = MOVIMIENTOS;
  protected readonly motivosCese = MOTIVOS_CESE;
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly textoMotivo = TEXTO_MOTIVO_CESE;
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly hoy = hoy();
  protected readonly accion = signal<Accion>('movimiento');
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formulario = new FormGroup({
    movimiento: new FormControl<Movimiento>('SIN_MOVIMIENTO', { nonNullable: true }),
    movimientoFecha: new FormControl('', { nonNullable: true }),
    motivoCese: new FormControl<MotivoCese | null>(null),
    fechaCese: new FormControl('', { nonNullable: true }),
    observacion: new FormControl('', { nonNullable: true }),
  });

  reiniciar(trabajador: TrabajadorResumen): void {
    this.accion.set('movimiento');
    this.error.set(null);
    this.formulario.reset({
      movimiento: trabajador.movimientoActual,
      movimientoFecha: trabajador.movimientoFecha ?? hoy(),
      motivoCese: null,
      fechaCese: hoy(),
      observacion: '',
    });
  }

  protected cerrarDialogo(): void {
    if (!this.guardando()) {
      this.cerrar.emit();
    }
  }

  protected async guardar(): Promise<void> {
    const trabajador = this.trabajador();
    if (trabajador === null) {
      return;
    }
    const valores = this.formulario.getRawValue();
    const observacion = valores.observacion.trim() === '' ? null : valores.observacion.trim();
    const esCese = this.accion() === 'cese';
    if (esCese && (valores.motivoCese === null || valores.fechaCese === '')) {
      this.error.set('Para registrar el cese indica el motivo y la fecha.');
      return;
    }
    if (!esCese && valores.movimiento !== 'SIN_MOVIMIENTO' && valores.movimientoFecha === '') {
      this.error.set('Indica la fecha del movimiento.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const detalle = await this.servicio.actualizarSituacion(trabajador.id, {
        estado: esCese ? 'CESADO' : 'ACTIVO',
        movimiento: esCese ? 'SIN_MOVIMIENTO' : valores.movimiento,
        movimientoFecha: esCese || valores.movimiento === 'SIN_MOVIMIENTO' ? null : valores.movimientoFecha,
        motivoCese: esCese ? valores.motivoCese : null,
        fechaCese: esCese ? valores.fechaCese : null,
        observacion,
      });
      this.actualizado.emit(detalle);
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}
