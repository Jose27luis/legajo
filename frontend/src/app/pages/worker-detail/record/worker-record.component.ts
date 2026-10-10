import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent } from '../../../components/dialog/dialog.component';
import { mensajeDeError } from '../../../core/errors';
import { TEXTO_ESTADO, TEXTO_MOTIVO_FIN, TEXTO_MOVIMIENTO, TEXTO_TIPO_PERSONAL, fechaCorta, hoy } from '../../../core/labels';
import type { Familiar, TrabajadorDetalle } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { ToastService } from '../../../core/toast.service';
import { WorkersService } from '../../../services/workers.service';
import { WorkerContext } from '../worker-context';

const opcional = (valor: string): string | null => (valor.trim() === '' ? null : valor.trim());

@Component({
  selector: 'app-worker-record',
  imports: [ReactiveFormsModule, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './worker-record.component.html',
  styleUrl: './worker-record.component.css',
})
export class WorkerRecordComponent {
  private readonly servicio = inject(WorkersService);
  private readonly avisos = inject(ToastService);
  protected readonly contexto = inject(WorkerContext);
  protected readonly sesion = inject(SessionService);

  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly textoMotivoFin = TEXTO_MOTIVO_FIN;
  protected readonly textoTipoPersonal = TEXTO_TIPO_PERSONAL;
  protected readonly fechaCorta = fechaCorta;
  protected readonly hoy = hoy();

  protected readonly familiarAbierto = signal(false);
  protected readonly familiarEditando = signal<Familiar | null>(null);
  protected readonly guardandoFamiliar = signal(false);
  protected readonly errorFamiliar = signal<string | null>(null);
  protected readonly familiar = new FormGroup({
    parentesco: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nombresApellidos: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    numeroDoc: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^([A-Za-z0-9]{8,12})?$/)] }),
    fechaNacimiento: new FormControl('', { nonNullable: true }),
  });
  protected readonly porQuitar = signal<Familiar | null>(null);
  protected readonly quitando = signal(false);

  protected ubicacion(trabajador: TrabajadorDetalle): string {
    return [trabajador.distrito, trabajador.provincia, trabajador.departamento]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(', ');
  }

  protected abrirFamiliar(familiar: Familiar | null): void {
    this.familiarEditando.set(familiar);
    this.errorFamiliar.set(null);
    this.familiar.reset({
      parentesco: familiar?.parentesco ?? '',
      nombresApellidos: familiar?.nombresApellidos ?? '',
      numeroDoc: familiar?.numeroDoc ?? '',
      fechaNacimiento: familiar?.fechaNacimiento ?? '',
    });
    this.familiarAbierto.set(true);
  }

  protected cerrarFamiliar(): void {
    if (!this.guardandoFamiliar()) {
      this.familiarAbierto.set(false);
    }
  }

  protected async guardarFamiliar(): Promise<void> {
    if (this.familiar.invalid) {
      this.familiar.markAllAsTouched();
      this.errorFamiliar.set('Revisa los campos marcados.');
      return;
    }
    const valores = this.familiar.getRawValue();
    const datos = {
      parentesco: valores.parentesco,
      nombresApellidos: valores.nombresApellidos.trim(),
      numeroDoc: opcional(valores.numeroDoc),
      fechaNacimiento: opcional(valores.fechaNacimiento),
    };
    const id = this.contexto.id();
    this.guardandoFamiliar.set(true);
    this.errorFamiliar.set(null);
    try {
      const editando = this.familiarEditando();
      if (editando === null) {
        await this.servicio.crearFamiliar(id, datos);
      } else {
        await this.servicio.editarFamiliar(id, editando.id, datos);
      }
      this.contexto.detalle.set(await this.servicio.obtener(id));
      this.familiarAbierto.set(false);
      this.avisos.exito(editando === null ? 'Familiar agregado' : 'Familiar actualizado');
    } catch (error: unknown) {
      this.errorFamiliar.set(mensajeDeError(error));
    } finally {
      this.guardandoFamiliar.set(false);
    }
  }

  protected cerrarQuitar(): void {
    if (!this.quitando()) {
      this.porQuitar.set(null);
    }
  }

  protected async confirmarQuitar(): Promise<void> {
    const familiar = this.porQuitar();
    if (familiar === null) {
      return;
    }
    const id = this.contexto.id();
    this.quitando.set(true);
    try {
      await this.servicio.quitarFamiliar(id, familiar.id);
      this.contexto.detalle.set(await this.servicio.obtener(id));
      this.porQuitar.set(null);
      this.avisos.exito('Familiar quitado');
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.quitando.set(false);
    }
  }
}
