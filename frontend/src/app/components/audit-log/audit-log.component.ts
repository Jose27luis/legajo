import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import { fechaHora } from '../../core/format';
import { valorDe } from '../../core/inputs';
import type { FiltrosAuditoria } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { AuditService } from '../../services/audit.service';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { PagerComponent } from '../pager/pager.component';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../search-select/search-select.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

type CampoFiltro = 'numeroDoc';
type CampoElegible = 'usuarioId' | 'accion';

@Component({
  selector: 'app-audit-log',
  imports: [RouterLink, SkeletonComponent, SearchSelectComponent, DatePickerComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css',
})
export class AuditLogComponent {
  private readonly servicio = inject(AuditService);
  protected readonly sesion = inject(SessionService);

  readonly trabajadorId = input('');
  readonly titulo = input('Historial de acciones');
  readonly porPagina = input<number | null>(null);

  protected readonly fechaHora = fechaHora;

  protected readonly filtros = linkedSignal<string, FiltrosAuditoria>({
    source: this.trabajadorId,
    computation: (trabajadorId) => ({ usuarioId: '', accion: '', numeroDoc: '', trabajadorId, desde: '', hasta: '' }),
  });
  protected readonly pagina = linkedSignal<FiltrosAuditoria, number>({ source: this.filtros, computation: () => 1 });

  protected readonly opciones = resource({ loader: () => this.servicio.opciones() });
  protected readonly registros = resource({
    params: () => ({ filtros: this.filtros(), pagina: this.pagina(), porPagina: this.porPagina() }),
    loader: ({ params }) => this.servicio.listar(params.filtros, params.pagina, params.porPagina),
  });

  protected readonly opcionesUsuario = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todos los usuarios' },
    ...(this.opciones.hasValue()
      ? this.opciones.value().usuarios.map((usuario) => ({ valor: usuario.id, etiqueta: `${usuario.nombre} (${usuario.usuario})` }))
      : []),
  ]);

  protected readonly opcionesAccion = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todas las acciones' },
    ...(this.opciones.hasValue() ? this.opciones.value().acciones.map((accion) => ({ valor: accion, etiqueta: accion })) : []),
  ]);

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

  protected cambiarFecha(campo: 'desde' | 'hasta', valor: string): void {
    this.filtros.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected elegir(campo: CampoElegible, valor: ValorOpcion): void {
    this.filtros.update((actual) => ({ ...actual, [campo]: typeof valor === 'string' ? valor : '' }));
  }

  protected limpiar(): void {
    this.filtros.set({ usuarioId: '', accion: '', numeroDoc: '', trabajadorId: this.trabajadorId(), desde: '', hasta: '' });
  }
}
