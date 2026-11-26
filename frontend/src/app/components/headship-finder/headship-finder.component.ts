import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import { normalizarTexto } from '../../core/format';
import { fechaCorta } from '../../core/labels';
import type { Asignacion, SituacionAsignacion } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { DocumentsService } from '../../services/documents.service';
import { HeadshipsService } from '../../services/headships.service';
import { DialogComponent } from '../dialog/dialog.component';
import { PagerComponent } from '../pager/pager.component';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../search-select/search-select.component';

type Pestana = 'eess' | 'microredes';
type FiltroEstado = 'todas' | 'con' | 'sin';

interface Sede {
  clave: string;
  nombre: string;
  detalle: string;
  microredId: number | null;
  actual: Asignacion | null;
  historial: Asignacion[];
  texto: string;
}

const POR_PAGINA = 15;

const PESTANAS: readonly { id: Pestana; etiqueta: string }[] = [
  { id: 'eess', etiqueta: 'Jefes de EESS' },
  { id: 'microredes', etiqueta: 'Gerentes de microred' },
];

const ESTADOS: readonly FiltroEstado[] = ['todas', 'con', 'sin'];

const TEXTO_SITUACION: Record<SituacionAsignacion, string> = {
  VIGENTE: 'Vigente',
  PROXIMA: 'Próxima',
  CONCLUIDA: 'Concluida',
};

const TONO_SITUACION: Record<SituacionAsignacion, string> = {
  VIGENTE: 'verde',
  PROXIMA: 'ambar',
  CONCLUIDA: 'gris',
};

function textoDe(asignaciones: readonly Asignacion[]): string {
  return asignaciones.map((asignacion) => `${asignacion.nombre} ${asignacion.documentoIdentidad}`).join(' ');
}

@Component({
  selector: 'app-headship-finder',
  imports: [RouterLink, DialogComponent, PagerComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './headship-finder.component.html',
  styleUrl: './headship-finder.component.css',
})
export class HeadshipFinderComponent {
  private readonly servicio = inject(HeadshipsService);
  private readonly documentos = inject(DocumentsService);
  protected readonly sesion = inject(SessionService);

  protected readonly datos = resource({ loader: () => this.servicio.listar() });
  protected readonly errorCarga = computed(() => {
    const error = this.datos.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly pestanas = PESTANAS;
  protected readonly pestana = signal<Pestana>('eess');
  protected readonly busqueda = signal('');
  protected readonly microredId = signal<number | null>(null);
  protected readonly estado = signal<FiltroEstado>('todas');
  protected readonly pagina = signal(1);
  protected readonly abierta = signal<Sede | null>(null);

  protected readonly fechaCorta = fechaCorta;
  protected readonly textoSituacion = TEXTO_SITUACION;
  protected readonly tonoSituacion = TONO_SITUACION;

  protected readonly resumen = computed(() => {
    if (!this.datos.hasValue()) {
      return null;
    }
    const { eess, microredes } = this.datos.value();
    return {
      eessConJefe: eess.filter((item) => item.actual !== null).length,
      eess: eess.length,
      microredesConGerente: microredes.filter((item) => item.actual !== null).length,
      microredes: microredes.length,
    };
  });

  protected readonly opcionesMicrored = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todas las microredes' },
    ...(this.datos.hasValue() ? this.datos.value().microredes : []).map((microred) => ({ valor: microred.id, etiqueta: microred.nombre })),
  ]);

  protected readonly opcionesEstado = computed<OpcionBuscable[]>(() => {
    const persona = this.pestana() === 'eess' ? 'jefe' : 'gerente';
    return [
      { valor: 'todas', etiqueta: 'Todas' },
      { valor: 'con', etiqueta: `Con ${persona} vigente` },
      { valor: 'sin', etiqueta: `Sin ${persona} vigente` },
    ];
  });

  private readonly sedes = computed<Sede[]>(() => {
    if (!this.datos.hasValue()) {
      return [];
    }
    const { eess, microredes } = this.datos.value();
    if (this.pestana() === 'eess') {
      return eess.map((item) => ({
        clave: `eess-${item.id}`,
        nombre: item.nombre,
        detalle: item.microred ?? 'Sin microred',
        microredId: item.microredId,
        actual: item.actual,
        historial: item.historial,
        texto: normalizarTexto(`${item.nombre} ${item.microred ?? ''} ${textoDe(item.historial)}`),
      }));
    }
    return microredes.map((item) => ({
      clave: `microred-${item.id}`,
      nombre: item.nombre,
      detalle: `${item.eess} EESS${item.activo ? '' : ' · inactiva'}`,
      microredId: item.id,
      actual: item.actual,
      historial: item.historial,
      texto: normalizarTexto(`${item.nombre} ${textoDe(item.historial)}`),
    }));
  });

  protected readonly filtradas = computed(() => {
    const termino = normalizarTexto(this.busqueda().trim());
    const microred = this.microredId();
    const estado = this.estado();
    return this.sedes().filter(
      (sede) =>
        (termino === '' || sede.texto.includes(termino)) &&
        (microred === null || sede.microredId === microred) &&
        (estado === 'todas' || (estado === 'con') === (sede.actual !== null)),
    );
  });

  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / POR_PAGINA)));

  protected readonly visibles = computed(() => {
    const pagina = Math.min(this.pagina(), this.paginas());
    return this.filtradas().slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  });

  recargar(): void {
    this.datos.reload();
  }

  protected seleccionar(pestana: Pestana): void {
    this.pestana.set(pestana);
    this.pagina.set(1);
  }

  protected moverConTeclado(evento: KeyboardEvent, indice: number): void {
    const desplazamiento = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    if (desplazamiento === 0) {
      return;
    }
    evento.preventDefault();
    const siguiente = PESTANAS[(indice + desplazamiento + PESTANAS.length) % PESTANAS.length];
    this.seleccionar(siguiente.id);
    document.getElementById(`jefaturas-pestana-${siguiente.id}`)?.focus();
  }

  protected buscar(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.busqueda.set(evento.target.value);
      this.pagina.set(1);
    }
  }

  protected filtrarMicrored(valor: ValorOpcion): void {
    this.microredId.set(typeof valor === 'number' ? valor : null);
    this.pagina.set(1);
  }

  protected filtrarEstado(valor: ValorOpcion): void {
    this.estado.set(ESTADOS.find((estado) => estado === valor) ?? 'todas');
    this.pagina.set(1);
  }

  protected limpiar(): void {
    this.busqueda.set('');
    this.microredId.set(null);
    this.estado.set('todas');
    this.pagina.set(1);
  }

  protected abrirHistorial(sede: Sede): void {
    this.abierta.set(sede);
  }

  protected cerrarHistorial(): void {
    this.abierta.set(null);
  }

  protected enlacePdf(asignacion: Asignacion): string {
    return this.documentos.enlaceArchivo(asignacion.documentoId, false);
  }

  protected periodo(asignacion: Asignacion): string {
    const desde = asignacion.desde === null ? 'Sin fecha de inicio' : fechaCorta(asignacion.desde);
    const hasta = asignacion.hasta === null ? 'sin fecha de término' : fechaCorta(asignacion.hasta);
    return `${desde} – ${hasta}`;
  }
}
