import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { SesionService } from '../../core/sesion.service';
import { mensajeDeError } from '../../core/errores';
import type { UsuarioSesion } from '../../core/modelos';

function clavesCoinciden(grupo: AbstractControl): ValidationErrors | null {
  const nueva: unknown = grupo.get('claveNueva')?.value;
  const confirmacion: unknown = grupo.get('confirmacion')?.value;
  return nueva === confirmacion ? null : { noCoinciden: true };
}

@Component({
  selector: 'app-formulario-clave',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './formulario-clave.component.html',
  styleUrl: './formulario-clave.component.css',
})
export class FormularioClaveComponent {
  private readonly sesion = inject(SesionService);

  readonly cambiada = output<UsuarioSesion>();

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal(false);
  protected readonly mostrar = signal(false);

  protected readonly formulario = new FormGroup(
    {
      claveActual: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
      claveNueva: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(100),
          Validators.pattern(/^(?=.*[A-Za-zÁÉÍÓÚÑáéíóúñ])(?=.*\d).+$/),
        ],
      }),
      confirmacion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: clavesCoinciden },
  );

  protected alternarVisibilidad(): void {
    this.mostrar.update((visible) => !visible);
  }

  protected invalido(campo: 'claveActual' | 'claveNueva' | 'confirmacion'): boolean {
    const control = this.formulario.controls[campo];
    if (campo === 'confirmacion') {
      return control.touched && (control.invalid || this.formulario.hasError('noCoinciden'));
    }
    return control.touched && control.invalid;
  }

  protected async guardar(): Promise<void> {
    this.exito.set(false);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set('Revisa los campos marcados.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const { claveActual, claveNueva } = this.formulario.getRawValue();
      const usuario = await this.sesion.cambiarClave(claveActual, claveNueva);
      this.formulario.reset();
      this.exito.set(true);
      this.cambiada.emit(usuario);
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}
