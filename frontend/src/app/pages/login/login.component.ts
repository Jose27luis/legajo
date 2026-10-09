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
import { SessionService } from '../../core/session.service';
import { mensajeDeError } from '../../core/errors';
import { prefiereMenosMovimiento } from '../../core/motion';
import { BrandComponent } from '../../components/brand/brand.component';
import { CabinetIllustrationComponent } from '../../components/cabinet-illustration/cabinet-illustration.component';

const CURVA_SUAVE: [number, number, number, number] = [0.22, 1, 0.36, 1];

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, BrandComponent, CabinetIllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements AfterViewInit {
  private readonly sesion = inject(SessionService);
  private readonly router = inject(Router);
  private readonly tarjeta = viewChild.required<ElementRef<HTMLElement>>('tarjeta');
  private readonly formularioAcceso = viewChild.required<ElementRef<HTMLFormElement>>('formularioAcceso');

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarClave = signal(false);
  protected readonly mayusculasActivas = signal(false);

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
      { opacity: [0, 1], transform: ['translateY(28px) scale(0.98)', 'translateY(0px) scale(1)'] },
      { duration: 0.65, ease: CURVA_SUAVE },
    );
    animate(
      this.formularioAcceso().nativeElement.querySelectorAll<HTMLElement>('.entra'),
      { opacity: [0, 1], transform: ['translateX(16px)', 'translateX(0px)'] },
      { delay: stagger(0.06, { startDelay: 0.25 }), duration: 0.5, ease: CURVA_SUAVE },
    );
  }

  protected alternarClave(): void {
    this.mostrarClave.update((visible) => !visible);
  }

  protected revisarMayusculas(evento: KeyboardEvent): void {
    this.mayusculasActivas.set(evento.getModifierState('CapsLock'));
  }

  protected invalido(campo: 'identificador' | 'clave'): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  protected async ingresar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set('Escribe tu usuario o correo y tu contraseña.');
      this.sacudir();
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    try {
      const { identificador, clave } = this.formulario.getRawValue();
      const usuario = await this.sesion.iniciar(identificador.trim(), clave);
      await this.salir();
      await this.router.navigateByUrl(usuario.debeCambiarClave ? '/change-password' : '/');
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
      this.formulario.controls.clave.reset();
      this.sacudir();
    } finally {
      this.enviando.set(false);
    }
  }

  private sacudir(): void {
    if (prefiereMenosMovimiento()) {
      return;
    }
    animate(
      this.formularioAcceso().nativeElement,
      { transform: ['translateX(0px)', 'translateX(-9px)', 'translateX(8px)', 'translateX(-5px)', 'translateX(3px)', 'translateX(0px)'] },
      { duration: 0.42, ease: 'easeOut' },
    );
  }

  private async salir(): Promise<void> {
    if (prefiereMenosMovimiento()) {
      return;
    }
    await animate(
      this.tarjeta().nativeElement,
      { opacity: [1, 0], transform: ['translateY(0px) scale(1)', 'translateY(-12px) scale(0.985)'] },
      { duration: 0.32, ease: CURVA_SUAVE },
    );
  }
}
