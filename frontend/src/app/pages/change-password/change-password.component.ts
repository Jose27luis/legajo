import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { BrandComponent } from '../../components/brand/brand.component';
import { PasswordFormComponent } from '../../components/password-form/password-form.component';

@Component({
  selector: 'app-change-password',
  imports: [BrandComponent, PasswordFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
})
export class ChangePasswordComponent {
  private readonly router = inject(Router);
  protected readonly sesion = inject(SessionService);
  protected readonly saliendo = signal(false);

  protected async continuar(): Promise<void> {
    await this.router.navigateByUrl('/');
  }

  protected async cerrarSesion(): Promise<void> {
    this.saliendo.set(true);
    try {
      await this.sesion.cerrar();
    } finally {
      this.saliendo.set(false);
      await this.router.navigateByUrl('/login');
    }
  }
}
