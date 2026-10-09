import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SesionService } from '../../core/sesion.service';
import { FormularioClaveComponent } from '../../components/formulario-clave/formulario-clave.component';

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Lima',
});

@Component({
  selector: 'app-perfil',
  imports: [FormularioClaveComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css',
})
export class PerfilComponent {
  protected readonly sesion = inject(SesionService);

  protected readonly ultimoIngreso = computed(() => {
    const fecha = this.sesion.usuario()?.ultimoAcceso;
    return fecha === null || fecha === undefined ? 'Sin registro' : formatoFecha.format(new Date(fecha));
  });
}
