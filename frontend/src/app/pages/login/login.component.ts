import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { animate, stagger } from 'motion';
import { SesionService } from '../../core/sesion.service';
import { mensajeDeError } from '../../core/errores';
import { SECCIONES_LEGAJO } from '../../core/modelos';
import { prefiereMenosMovimiento } from '../../core/movimiento';
import { MarcaComponent } from '../../components/marca/marca.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MarcaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements AfterViewInit {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly archivador = viewChild.required<ElementRef<HTMLElement>>('archivador');
  private readonly tarjeta = viewChild.required<ElementRef<HTMLElement>>('tarjeta');

  protected readonly secciones = SECCIONES_LEGAJO;
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarClave = signal(false);

  protected readonly formulario = new FormGroup({
    identificador: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(120)],
    }),
    clave: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
  });

  ngAfterViewInit(): void {
    if (prefiereMenosMovimiento()) {
      return;
    }
    animate(
      this.tarjeta().nativeElement,
      { opacity: [0, 1], transform: ['translateY(24px) scale(0.985)', 'translateY(0px) scale(1)'] },
      { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    );
    const pestanas = this.archivador().nativeElement.querySelectorAll<HTMLElement>('.pestana');
    animate(
      pestanas,
      { opacity: [0, 1], transform: ['translateY(18px)', 'translateY(0px)'] },
      { delay: stagger(0.035, { startDelay: 0.3 }), duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    );
  }

  protected alternarClave(): void {
    this.mostrarClave.update((visible) => !visible);
  }

  protected invalido(campo: 'identificador' | 'clave'): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  protected async ingresar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set('Escribe tu usuario o correo y tu contraseña.');
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    try {
      const { identificador, clave } = this.formulario.getRawValue();
      const usuario = await this.sesion.iniciar(identificador.trim(), clave);
      await this.router.navigateByUrl(usuario.debeCambiarClave ? '/cambiar-clave' : '/');
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
      this.formulario.controls.clave.reset();
    } finally {
      this.enviando.set(false);
    }
  }
}
