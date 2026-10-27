import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import {
  CLASE_ESTADO_DOCUMENTO,
  TEXTO_ESTADO_DOCUMENTO,
  TEXTO_MOTIVO_FIN,
  esSalidaDocumentada,
  fechaCorta,
  nombreCompleto,
} from '../../core/labels';
import type { CampoSeccion, Documento, SeccionLegajo, TrabajadorDetalle, ValorCampo, Vinculo } from '../../core/models';
import { paginar } from '../../core/pagination';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { DocumentsService } from '../../services/documents.service';
import { LinkOptionsService } from '../../services/link-options.service';
import { camposDelDocumento, opcionesContrato } from '../document-fields/document-form';
import { PagerComponent } from '../pager/pager.component';

const PERIODOS_POR_PAGINA = 5;

interface Fecha {
  etiqueta: string;
  valor: string;
}

interface Fila {
  etiqueta: string;
  valor: string;
}

interface Periodo {
  vinculo: Vinculo;
  cese: boolean;
  estado: 'ACTIVO' | 'CESADO' | 'CONCLUIDO';
  evento: string | null;
  contratos: Documento[];
  ceses: Documento[];
  fechas: Fecha[];
  pista: string;
}

interface BloqueDatos {
  documento: Documento;
  titulo: string;
  cese: boolean;
  filas: Fila[];
}

const vigente = (documento: Documento): boolean => documento.estado !== 'ANULADO';

@Component({
  selector: 'app-link-timeline',
  imports: [PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-timeline.component.html',
  styleUrl: './link-timeline.component.css',
})
export class LinkTimelineComponent {
  private readonly servicio = inject(DocumentsService);
  private readonly avisos = inject(ToastService);
  private readonly router = inject(Router);
  private readonly opcionesVinculo = inject(LinkOptionsService);
  protected readonly sesion = inject(SessionService);

  readonly trabajador = input<TrabajadorDetalle | null>(null);
  readonly documentos = input<Documento[]>([]);
  readonly secciones = input<SeccionLegajo[]>([]);
  readonly registrado = output<Documento>();

  protected readonly textoEstado = TEXTO_ESTADO_DOCUMENTO;
  protected readonly claseEstado = CLASE_ESTADO_DOCUMENTO;
  protected readonly fechaCorta = fechaCorta;
  protected readonly nombreCompleto = nombreCompleto;

  protected readonly periodos = computed<Periodo[]>(() => (this.trabajador()?.vinculos ?? []).map((vinculo) => this.describir(vinculo)));
  protected readonly paginacion = paginar(
    () => this.periodos(),
    PERIODOS_POR_PAGINA,
    () => this.trabajador()?.id,
  );

  protected readonly elegidoId = linkedSignal<string | undefined, string | null>({
    source: () => this.trabajador()?.id,
    computation: () => null,
  });
  protected readonly elegido = computed(() => this.periodos().find((periodo) => periodo.vinculo.id === this.elegidoId()) ?? null);
  protected readonly principal = computed(() => {
    const periodo = this.elegido();
    return periodo === null ? null : ((periodo.cese ? periodo.ceses[0] : periodo.contratos[0]) ?? null);
  });
  protected readonly bloques = computed<BloqueDatos[]>(() => {
    const periodo = this.elegido();
    return periodo === null ? [] : [...periodo.ceses, ...periodo.contratos].map((documento) => this.bloque(documento, periodo));
  });
  protected readonly sinEnlazar = computed(() => {
    const periodo = this.elegido();
    return periodo === null || periodo.cese
      ? []
      : this.documentos().filter(
          (documento) =>
            documento.seccion === 2 && documento.tipo.accion === 'VINCULO' && documento.vinculoId === null && vigente(documento),
        );
  });
  protected readonly puedeEnlazar = computed(() => this.sesion.tiene('personal.editar'));
  protected readonly enlazando = signal<string | null>(null);
  protected readonly error = linkedSignal<string | null, string | null>({ source: this.elegidoId, computation: () => null });

  constructor() {
    void this.opcionesVinculo.cargar().catch(() => undefined);
  }

  protected elegir(vinculo: Vinculo): void {
    this.elegidoId.set(this.elegidoId() === vinculo.id ? null : vinculo.id);
  }

  protected cerrar(): void {
    if (this.enlazando() === null) {
      this.elegidoId.set(null);
    }
  }

  protected enlace(documento: Documento): string {
    return this.servicio.enlaceArchivo(documento.id, false);
  }

  protected nombreArchivo(documento: Documento): string {
    return documento.versiones.find((version) => version.actual)?.nombreOriginal ?? documento.tipo.nombre;
  }

  protected irASeccion(): void {
    const trabajador = this.trabajador();
    const periodo = this.elegido();
    if (trabajador !== null && periodo !== null) {
      void this.router.navigate(['/workers', trabajador.id, 'sections', periodo.cese ? 11 : 2]);
    }
  }

  protected async enlazar(documento: Documento): Promise<void> {
    const periodo = this.elegido();
    if (periodo === null || this.enlazando() !== null) {
      return;
    }
    this.enlazando.set(documento.id);
    this.error.set(null);
    try {
      const actualizado = await this.servicio.enlazarPeriodo(documento.id, periodo.vinculo.id);
      this.registrado.emit(actualizado);
      this.avisos.exito('Contrato enlazado al período laboral.');
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.enlazando.set(null);
    }
  }

  private describir(vinculo: Vinculo): Periodo {
    const documentos = this.documentos();
    const cese = esSalidaDocumentada(vinculo, documentos);
    const contratos = documentos.filter((documento) => documento.vinculoId === vinculo.id && documento.seccion === 2 && vigente(documento));
    const ceses = documentos.filter((documento) => documento.vinculoId === vinculo.id && documento.seccion === 11 && vigente(documento));
    const fin = vinculo.fechaFin === null ? 'presente' : fechaCorta(vinculo.fechaFin);
    const estado = vinculo.fechaFin === null ? 'ACTIVO' : cese ? 'CESADO' : 'CONCLUIDO';
    const sustento = cese ? ceses.length > 0 : contratos.length > 0;
    return {
      vinculo,
      cese,
      estado,
      evento: vinculo.motivoFin === null ? null : `Terminó por ${TEXTO_MOTIVO_FIN[vinculo.motivoFin].toLowerCase()}`,
      contratos,
      ceses,
      fechas: cese
        ? [
            { etiqueta: 'Inicio', valor: fechaCorta(vinculo.fechaInicio) },
            { etiqueta: 'Fecha efectiva de cese', valor: fin },
          ]
        : [
            { etiqueta: 'Inicio', valor: fechaCorta(vinculo.fechaInicio) },
            { etiqueta: 'Fin', valor: fin },
          ],
      pista: sustento
        ? `Ver documento sustentatorio · Sección ${cese ? '11' : '02'}`
        : `Sin documento sustentatorio · Sección ${cese ? '11' : '02'}`,
    };
  }

  private bloque(documento: Documento, periodo: Periodo): BloqueDatos {
    const esCese = documento.seccion === 11;
    const nombre = documento.tipo.nombre.toLowerCase();
    const titulo = esCese ? (nombre.includes('renuncia') ? 'Datos de la renuncia' : 'Datos del cese') : 'Datos del contrato';
    const seccion = this.secciones().find((item) => item.numero === documento.seccion) ?? null;
    const formulario = documento.tipo.formulario;
    const filas: Fila[] = [];
    if (formulario.numero || documento.numero !== null) {
      filas.push({ etiqueta: formulario.numero ?? 'Número de documento', valor: documento.numero ?? '—' });
    }
    if (formulario.fechaEmision || documento.fechaEmision !== null) {
      filas.push({
        etiqueta: formulario.fechaEmision ?? 'Fecha de emisión',
        valor: documento.fechaEmision ? fechaCorta(documento.fechaEmision) : '—',
      });
    }
    if (formulario.presentadoPor) {
      const trabajador = this.trabajador();
      filas.push({ etiqueta: formulario.presentadoPor, valor: trabajador === null ? '—' : nombreCompleto(trabajador) });
    }
    if (formulario.emisor || documento.emisor !== null) {
      filas.push({ etiqueta: formulario.emisor ?? 'Emitido por', valor: documento.emisor ?? '—' });
    }
    const campos = seccion === null ? documento.tipo.campos : camposDelDocumento(seccion, documento.tipo);
    for (const campo of campos) {
      filas.push({ etiqueta: campo.etiqueta, valor: this.mostrar(campo, documento.datos[campo.clave] ?? null) });
    }
    if (documento.observaciones !== null && documento.observaciones !== '') {
      filas.push({ etiqueta: 'Descripción y observaciones', valor: documento.observaciones });
    }
    return { documento, titulo, cese: esCese && periodo.cese, filas };
  }

  private mostrar(campo: CampoSeccion, valor: ValorCampo): string {
    if (valor === null || valor === '') {
      return '—';
    }
    if (campo.tipo === 'contrato') {
      return opcionesContrato(this.documentos()).find((opcion) => opcion.valor === valor)?.etiqueta ?? 'Contrato no disponible';
    }
    const opciones = this.opcionesVinculo.opciones();
    if (typeof valor === 'number' && opciones !== null) {
      if (campo.tipo === 'regimen') {
        return opciones.regimenes.find((item) => item.id === valor)?.nombre ?? String(valor);
      }
      if (campo.tipo === 'area') {
        return opciones.areas.find((item) => item.id === valor)?.nombre ?? String(valor);
      }
      if (campo.tipo === 'cargo') {
        return opciones.cargos.find((item) => item.id === valor)?.nombre ?? String(valor);
      }
    }
    return campo.tipo === 'fecha' && typeof valor === 'string' ? fechaCorta(valor) : String(valor);
  }
}
