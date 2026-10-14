import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import { nombreCompleto } from '../../core/labels';
import { SelectedWorkerService } from '../../services/selected-worker.service';
import { WorkersService } from '../../services/workers.service';

const ESPERA_MS = 300;
const MINIMO = 2;

@Component({
  selector: 'app-legajos',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legajos.component.html',
  styleUrl: './legajos.component.css',
})
export class LegajosComponent {
  private readonly servicio = inject(WorkersService);
  private readonly router = inject(Router);
  private readonly elegido = inject(SelectedWorkerService).actual;

  protected readonly nombreCompleto = nombreCompleto;
  protected readonly texto = signal('');
  private readonly termino = signal('');

  protected readonly resultados = resource({
    params: () => (this.termino().length < MINIMO ? undefined : this.termino()),
    loader: async ({ params }) => {
      const pagina = await this.servicio.listar({ busqueda: params, estado: '', movimiento: '', areaId: null, pagina: 1 });
      return pagina.items.slice(0, 30);
    },
  });
  protected readonly error = computed(() => {
    const error = this.resultados.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  constructor() {
    const actual = this.elegido();
    if (actual !== null) {
      void this.router.navigate(['/workers', actual.id], { replaceUrl: true });
    }
    effect((alLimpiar) => {
      const texto = this.texto().trim();
      const temporizador = setTimeout(() => this.termino.set(texto), ESPERA_MS);
      alLimpiar(() => clearTimeout(temporizador));
    });
  }

  protected alEscribir(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.texto.set(evento.target.value);
    }
  }
}
