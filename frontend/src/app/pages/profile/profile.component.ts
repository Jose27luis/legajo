import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SessionService } from '../../core/session.service';
import { PasswordFormComponent } from '../../components/password-form/password-form.component';

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
  protected readonly sesion = inject(SessionService);

  protected readonly ultimoIngreso = computed(() => {
    const fecha = this.sesion.usuario()?.ultimoAcceso;
    return fecha === null || fecha === undefined ? 'Sin registro' : formatoFecha.format(new Date(fecha));
  });
}
