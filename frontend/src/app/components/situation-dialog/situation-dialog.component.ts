import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogComponent } from '../dialog/dialog.component';
import { mensajeDeError } from '../../core/errors';
import { MOTIVOS_CESE, MOVIMIENTOS, TEXTO_MOTIVO_CESE, TEXTO_MOVIMIENTO, hoy, nombreCompleto } from '../../core/labels';
import type { EstadoTrabajador, MotivoCese, Movimiento, TrabajadorDetalle, TrabajadorResumen } from '../../core/models';
import { LinkOptionsService } from '../../services/link-options.service';
import { WorkersService } from '../../services/workers.service';

@Component({
  selector: 'app-situation-dialog',
  imports: [ReactiveFormsModule, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './situation-dialog.component.html',
  styleUrl: './situation-dialog.component.css',
})
export class SituationDialogComponent {
  private readonly servicio = inject(WorkersService);
  private readonly router = inject(Router);
  private readonly opcionesVinculo = inject(LinkOptionsService);

  readonly trabajador = input.required<TrabajadorResumen | null>();
  readonly cerrar = output();
  readonly actualizado = output<TrabajadorDetalle>();

  protected readonly movimientos = MOVIMIENTOS;
  protected readonly motivosCese = MOTIVOS_CESE;
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly textoMotivo = TEXTO_MOTIVO_CESE;
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly hoy = hoy();
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly ceseConDocumento = signal(false);
  protected readonly areas = computed(() => this.opcionesVinculo.opciones()?.areas ?? []);

  protected readonly formulario = new FormGroup({
    estado: new FormControl<EstadoTrabajador>('ACTIVO', { nonNullable: true }),
    movimiento: new FormControl<Movimiento>('SIN_MOVIMIENTO', { nonNullable: true }),
    movimientoFecha: new FormControl('', { nonNullable: true }),
    areaOrigenId: new FormControl<number | null>(null),
    areaDestinoId: new FormControl<number | null>(null),
    motivoCese: new FormControl<MotivoCese | null>(null),
    fechaCese: new FormControl('', { nonNullable: true }),
    observacion: new FormControl('', { nonNullable: true }),
  });

  protected readonly estadoElegido = toSignal(this.formulario.controls.estado.valueChanges, {
    initialValue: this.formulario.controls.estado.value,
  });
  protected readonly movimientoElegido = toSignal(this.formulario.controls.movimiento.valueChanges, {
    initialValue: this.formulario.controls.movimiento.value,
  });

  reiniciar(trabajador: TrabajadorResumen): void {
    void this.opcionesVinculo.cargar();
    this.error.set(null);
    this.ceseConDocumento.set(false);
    this.formulario.reset({
      estado: trabajador.estado,
      movimiento: trabajador.movimientoActual,
      movimientoFecha: trabajador.movimientoFecha ?? hoy(),
      areaOrigenId: trabajador.vinculo?.area.id ?? null,
      areaDestinoId: null,
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

  protected irASeccion11(): void {
    const trabajador = this.trabajador();
    if (trabajador !== null) {
      this.cerrar.emit();
      void this.router.navigate(['/workers', trabajador.id, 'sections', 11]);
    }
  }

  protected async guardar(): Promise<void> {
    const trabajador = this.trabajador();
    if (trabajador === null) {
      return;
    }
    const valores = this.formulario.getRawValue();
    if (valores.estado === 'CESADO') {
      if (valores.motivoCese === null || valores.fechaCese === '') {
        this.error.set('Para CESADO son obligatorios el motivo y la fecha de cese.');
        return;
      }
      this.error.set(null);
      this.ceseConDocumento.set(true);
      return;
    }
    const conMovimiento = valores.movimiento !== 'SIN_MOVIMIENTO';
    if (conMovimiento && (valores.movimientoFecha === '' || valores.areaOrigenId === null || valores.areaDestinoId === null)) {
      this.error.set('Indica la fecha del movimiento, el área de origen y el área de destino.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const detalle = await this.servicio.actualizarSituacion(trabajador.id, {
        estado: 'ACTIVO',
        movimiento: valores.movimiento,
        movimientoFecha: conMovimiento ? valores.movimientoFecha : null,
        areaOrigenId: conMovimiento ? valores.areaOrigenId : null,
        areaDestinoId: conMovimiento ? valores.areaDestinoId : null,
        motivoCese: null,
        fechaCese: null,
        observacion: valores.observacion.trim() === '' ? null : valores.observacion.trim(),
      });
      this.actualizado.emit(detalle);
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}
