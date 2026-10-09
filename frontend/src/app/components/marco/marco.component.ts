import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SesionService } from '../../core/sesion.service';
import { MarcaComponent } from '../marca/marca.component';

@Component({
  selector: 'app-marco',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MarcaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marco.component.html',
  styleUrl: './marco.component.css',
})
export class MarcoComponent {
  private readonly router = inject(Router);
  protected readonly sesion = inject(SesionService);
  protected readonly saliendo = signal(false);

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
