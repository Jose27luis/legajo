import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, resource, signal } from '@angular/core';
import { nombreCompleto } from '../../core/labels';
import type { TrabajadorLote, TrabajadorResumen } from '../../core/models';
import { WorkersService } from '../../services/workers.service';
import { SpinnerComponent } from '../spinner/spinner.component';

const ESPERA_MS = 300;
const MINIMO = 2;

@Component({
  selector: 'app-worker-picker',
  imports: [SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './worker-picker.component.html',
  styleUrl: './worker-picker.component.css',
})
export class WorkerPickerComponent {
  private readonly servicio = inject(WorkersService);

  readonly elegido = model<TrabajadorLote | null>(null);
  readonly idCampo = input.required<string>();
  readonly invalido = input(false);

  protected readonly texto = signal('');
  private readonly termino = signal('');
  protected readonly abierto = signal(false);

  protected readonly resultados = resource({
    params: () => (this.termino().length < MINIMO ? undefined : this.termino()),
    loader: async ({ params }) => {
      const pagina = await this.servicio.listar({ busqueda: params, estado: '', movimiento: '', areaId: null, pagina: 1 });
      return pagina.items.slice(0, 8);
    },
  });

  protected readonly sinResultados = computed(
    () => this.termino().length >= MINIMO && this.resultados.hasValue() && this.resultados.value().length === 0,
  );

  constructor() {
    effect((alLimpiar) => {
      const texto = this.texto().trim();
      const temporizador = setTimeout(() => this.termino.set(texto), ESPERA_MS);
      alLimpiar(() => clearTimeout(temporizador));
    });
  }

  limpiar(): void {
    this.elegido.set(null);
    this.texto.set('');
    this.termino.set('');
    this.abierto.set(false);
  }

  protected nombre(trabajador: TrabajadorResumen): string {
    return nombreCompleto(trabajador);
  }

  protected alEscribir(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.texto.set(evento.target.value);
      this.abierto.set(true);
    }
  }

  protected elegir(trabajador: TrabajadorResumen): void {
    this.elegido.set({ id: trabajador.id, numeroDoc: trabajador.numeroDoc, nombre: nombreCompleto(trabajador) });
    this.abierto.set(false);
    this.texto.set('');
    this.termino.set('');
  }

  protected quitar(): void {
    this.limpiar();
  }

  protected cerrar(): void {
    setTimeout(() => this.abierto.set(false), 150);
  }
}
