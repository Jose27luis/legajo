import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { DialogComponent } from '../dialog/dialog.component';
import { LinkFieldsComponent } from '../link-fields/link-fields.component';
import { crearCamposVinculo, leerCamposVinculo, reiniciarCamposVinculo } from '../link-fields/link-form';
import { mensajeDeError } from '../../core/errors';
import { fechaCorta, hoy, nombreCompleto } from '../../core/labels';
import type { TrabajadorDetalle, TrabajadorResumen } from '../../core/models';
import { WorkersService } from '../../services/workers.service';

@Component({
  selector: 'app-reentry-dialog',
  imports: [ReactiveFormsModule, DialogComponent, LinkFieldsComponent, DatePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reentry-dialog.component.html',
  styleUrl: './reentry-dialog.component.css',
})
export class ReentryDialogComponent {
  private readonly servicio = inject(WorkersService);

  readonly trabajador = input.required<TrabajadorResumen | null>();
  readonly cerrar = output();
  readonly actualizado = output<TrabajadorDetalle>();

  protected readonly nombreCompleto = nombreCompleto;
  protected readonly fechaCorta = fechaCorta;
  protected readonly hoy = hoy();
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly vinculo = crearCamposVinculo();
  protected readonly fechaIngreso = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  reiniciar(trabajador: TrabajadorResumen): void {
    this.error.set(null);
    this.fechaIngreso.reset(hoy());
    reiniciarCamposVinculo(this.vinculo, trabajador.vinculo);
  }

  protected cerrarDialogo(): void {
    if (!this.guardando()) {
      this.cerrar.emit();
    }
  }

  protected async guardar(): Promise<void> {
    const trabajador = this.trabajador();
    const datos = leerCamposVinculo(this.vinculo);
    if (trabajador === null) {
      return;
    }
    if (datos === null || this.fechaIngreso.invalid) {
      this.vinculo.markAllAsTouched();
      this.fechaIngreso.markAsTouched();
      this.error.set('Completa la fecha y los datos del nuevo vínculo.');
      return;
    }
    const cese = trabajador.vinculo?.fechaFin ?? null;
    if (cese !== null && this.fechaIngreso.value <= cese) {
      this.error.set(`El reingreso debe ser posterior al último cese (${fechaCorta(cese)}).`);
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      this.actualizado.emit(await this.servicio.reingresar(trabajador.id, { ...datos, fechaIngreso: this.fechaIngreso.value }));
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}
