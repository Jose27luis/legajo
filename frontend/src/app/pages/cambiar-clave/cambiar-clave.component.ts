import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SesionService } from '../../core/sesion.service';
import { MarcaComponent } from '../../components/marca/marca.component';
import { FormularioClaveComponent } from '../../components/formulario-clave/formulario-clave.component';

@Component({
  selector: 'app-cambiar-clave',
  imports: [MarcaComponent, FormularioClaveComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cambiar-clave.component.html',
  styleUrl: './cambiar-clave.component.css',
})
export class CambiarClaveComponent {
  private readonly router = inject(Router);
  protected readonly sesion = inject(SesionService);
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
