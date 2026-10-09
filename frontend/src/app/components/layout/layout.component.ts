import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { BrandComponent } from '../brand/brand.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent {
  private readonly router = inject(Router);
  protected readonly sesion = inject(SessionService);
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
