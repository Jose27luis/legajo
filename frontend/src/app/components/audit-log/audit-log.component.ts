import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import { fechaHora } from '../../core/format';
import { valorDe } from '../../core/inputs';
import type { FiltrosAuditoria } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { AuditService } from '../../services/audit.service';

type CampoFiltro = 'usuarioId' | 'accion' | 'numeroDoc' | 'desde' | 'hasta';

@Component({
  selector: 'app-audit-log',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css',
})
export class AuditLogComponent {
  private readonly servicio = inject(AuditService);
  protected readonly sesion = inject(SessionService);

  readonly trabajadorId = input('');
  readonly titulo = input('Historial de acciones');

  protected readonly fechaHora = fechaHora;

  protected readonly filtros = linkedSignal<string, FiltrosAuditoria>({
    source: this.trabajadorId,
    computation: (trabajadorId) => ({ usuarioId: '', accion: '', numeroDoc: '', trabajadorId, desde: '', hasta: '' }),
  });
  protected readonly pagina = linkedSignal<FiltrosAuditoria, number>({ source: this.filtros, computation: () => 1 });

  protected readonly opciones = resource({ loader: () => this.servicio.opciones() });
  protected readonly registros = resource({
    params: () => ({ filtros: this.filtros(), pagina: this.pagina() }),
    loader: ({ params }) => this.servicio.listar(params.filtros, params.pagina),
  });

  protected readonly error = computed(() => {
    const error = this.registros.error();
    return error === undefined ? null : mensajeDeError(error);
  });
  protected readonly enlace = computed(() => this.servicio.enlaceExcel(this.filtros()));
  protected readonly ultimaPagina = computed(() => {
    if (!this.registros.hasValue()) {
      return 1;
    }
    const datos = this.registros.value();
    return Math.max(1, Math.ceil(datos.total / datos.porPagina));
  });

  protected cambiar(campo: CampoFiltro, evento: Event): void {
    const valor = valorDe(evento).trim();
    this.filtros.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected limpiar(): void {
    this.filtros.set({ usuarioId: '', accion: '', numeroDoc: '', trabajadorId: this.trabajadorId(), desde: '', hasta: '' });
  }
}
