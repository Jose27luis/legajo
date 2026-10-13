import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { PasswordFormComponent } from '../../components/password-form/password-form.component';
import { SelectedWorkerService } from '../../services/selected-worker.service';

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Lima',
});

@Component({
  selector: 'app-profile',
  imports: [PasswordFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  private readonly router = inject(Router);
  private readonly trabajadorElegido = inject(SelectedWorkerService);
  protected readonly sesion = inject(SessionService);

  protected readonly cambiandoClave = signal(false);
  protected readonly saliendo = signal(false);

  protected readonly ultimoIngreso = computed(() => {
    const fecha = this.sesion.usuario()?.ultimoAcceso;
    return fecha === null || fecha === undefined ? 'Sin registro' : formatoFecha.format(new Date(fecha));
  });

  protected async cerrarSesion(): Promise<void> {
    this.saliendo.set(true);
    try {
      await this.sesion.cerrar();
    } finally {
      this.trabajadorElegido.limpiar();
      this.saliendo.set(false);
      await this.router.navigateByUrl('/login');
    }
  }
}
