import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocumentDialogComponent } from '../../../components/document-dialog/document-dialog.component';
import { DocumentFieldsComponent } from '../../../components/document-fields/document-fields.component';
import {
  crearFormularioDocumento,
  leerFormularioDocumento,
  prepararFormularioDocumento,
} from '../../../components/document-fields/document-form';
import { PdfPickerComponent } from '../../../components/pdf-picker/pdf-picker.component';
import { mensajeDeError } from '../../../core/errors';
import { fechaHora, normalizarTexto } from '../../../core/format';
import {
  CLASE_ESTADO_DOCUMENTO,
  ESTADOS_DOCUMENTO,
  TEXTO_ESTADO_DOCUMENTO,
  TEXTO_NIVEL_ACCESO,
  nombreCompleto,
  numeroSeccion,
  tonoSeccion,
} from '../../../core/labels';
import type { Documento, EstadoDocumento, SeccionLegajo } from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { ToastService } from '../../../core/toast.service';
import { DocumentsService, mensajeDeSubida, type SubidaEnCurso } from '../../../services/documents.service';
import { WorkerContext } from '../worker-context';

const AVISOS: Record<number, { texto: string; sensible: boolean }> = {
  10: {
    texto:
      'Acceso sensible: los documentos de salud ocupacional requieren permisos especiales. No anotes diagnósticos ni datos clínicos en los campos.',
    sensible: true,
  },
  11: {
    texto:
      'Registrar un PDF de cese no cambia por sí solo el estado laboral. El cese se registra en Estado y movimiento, con su sustento.',
    sensible: false,
  },
  12: {
    texto: 'Usa esta sección solo cuando el documento no corresponda a ninguna de las otras doce. La justificación es obligatoria.',
    sensible: false,
  },
  13: {
    texto: 'Las vacaciones, licencias y permisos se guardan aquí y no se mezclan con la sección 09.',
    sensible: false,
  },
};

const AVISO_GENERAL = {
  texto:
    'Los documentos de distintos años conviven en la sección. Reemplazar solo corrige el mismo PDF y la fecha de carga se registra sola.',
  sensible: false,
};

@Component({
  selector: 'app-legajo-section',
  imports: [RouterLink, DocumentFieldsComponent, PdfPickerComponent, DocumentDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legajo-section.component.html',
  styleUrl: './legajo-section.component.css',
})
export class LegajoSectionComponent implements OnDestroy {
  private readonly servicio = inject(DocumentsService);
  private readonly avisos = inject(ToastService);
  protected readonly contexto = inject(WorkerContext);
  protected readonly sesion = inject(SessionService);

  readonly numero = input.required<string>();

  private readonly selector = viewChild(PdfPickerComponent);

  protected readonly estados = ESTADOS_DOCUMENTO;
  protected readonly textoEstado = TEXTO_ESTADO_DOCUMENTO;
  protected readonly claseEstado = CLASE_ESTADO_DOCUMENTO;
  protected readonly textoNivel = TEXTO_NIVEL_ACCESO;
  protected readonly numeroSeccion = numeroSeccion;
  protected readonly tono = tonoSeccion;
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly fechaHora = fechaHora;

  protected readonly seccion = computed(() => {
    if (!this.contexto.legajo.hasValue()) {
      return null;
    }
    const numero = Number(this.numero());
    return this.contexto.legajo.value().secciones.find((item) => item.numero === numero) ?? null;
  });
  private readonly idSeccion = computed(() => this.seccion()?.id ?? null);

  protected readonly aviso = computed(() => AVISOS[Number(this.numero())] ?? AVISO_GENERAL);

  protected readonly busqueda = linkedSignal({ source: this.idSeccion, computation: () => '' });
  protected readonly filtroEstado = linkedSignal<number | null, EstadoDocumento | ''>({
    source: this.idSeccion,
    computation: () => '',
  });

  private readonly todos = computed(() => {
    const numero = Number(this.numero());
    return this.contexto.legajo.hasValue()
      ? this.contexto.legajo.value().documentos.filter((documento) => documento.seccion === numero)
      : [];
  });

  protected readonly documentos = computed(() => {
    const termino = normalizarTexto(this.busqueda());
    const estado = this.filtroEstado();
    return this.todos().filter(
      (documento) =>
        (estado === '' || documento.estado === estado) &&
        (termino === '' ||
          normalizarTexto(
            [
              documento.tipo.codigo,
              documento.tipo.nombre,
              documento.numero ?? '',
              documento.observaciones ?? '',
              documento.versiones.find((version) => version.actual)?.nombreOriginal ?? '',
            ].join(' '),
          ).includes(termino)),
    );
  });

  protected readonly hayDisponibles = computed(() => this.todos().some((documento) => documento.estado === 'DISPONIBLE'));

  protected etiquetasPropias(seccion: SeccionLegajo): string {
    return seccion.campos.map((campo) => campo.etiqueta).join(' · ');
  }

  protected listaTipos(seccion: SeccionLegajo): string {
    return seccion.tipos.map((tipo) => `${tipo.codigo} ${tipo.nombre}`).join(' · ');
  }

  protected readonly enlaceZip = computed(() => this.servicio.enlaceZip(this.contexto.id(), [Number(this.numero())]));

  protected readonly seleccionadoId = signal<string | null>(null);
  protected readonly seleccionado = computed(() => {
    const id = this.seleccionadoId();
    return id === null ? null : (this.todos().find((documento) => documento.id === id) ?? null);
  });

  protected readonly formulario = crearFormularioDocumento();
  protected readonly archivo = linkedSignal<number | null, File | null>({ source: this.idSeccion, computation: () => null });
  protected readonly progreso = signal<number | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly archivoFaltante = signal(false);

  private subida: SubidaEnCurso | null = null;
  private subidaLista: { archivo: File; id: string } | null = null;

  constructor() {
    effect(() => {
      if (this.idSeccion() === null) {
        return;
      }
      const seccion = untracked(this.seccion);
      if (seccion !== null) {
        prepararFormularioDocumento(this.formulario, seccion, null);
      }
    });
  }

  ngOnDestroy(): void {
    this.subida?.cancelar();
  }

  protected alBuscar(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.busqueda.set(evento.target.value);
    }
  }

  protected alFiltrar(evento: Event): void {
    if (evento.target instanceof HTMLSelectElement) {
      const valor = evento.target.value;
      this.filtroEstado.set(this.estados.find((estado) => estado === valor) ?? '');
    }
  }

  protected nombreArchivo(documento: Documento): string {
    return documento.versiones.find((version) => version.actual)?.nombreOriginal ?? documento.tipo.nombre;
  }

  protected referencia(documento: Documento): string {
    const partes = [documento.tipo.codigo, documento.numero ?? 'Sin número'];
    if (documento.fechaEmision !== null) {
      partes.push(documento.fechaEmision.slice(0, 4));
    }
    return partes.join(' · ');
  }

  protected limpiar(): void {
    const seccion = this.seccion();
    if (this.ocupado() || seccion === null) {
      return;
    }
    prepararFormularioDocumento(this.formulario, seccion, null);
    this.selector()?.limpiar();
    this.error.set(null);
    this.archivoFaltante.set(false);
  }

  protected cancelarSubida(): void {
    this.subida?.cancelar();
  }

  protected async registrar(): Promise<void> {
    const seccion = this.seccion();
    if (seccion === null || this.ocupado()) {
      return;
    }
    const datos = leerFormularioDocumento(this.formulario, seccion);
    const archivo = this.archivo();
    this.archivoFaltante.set(archivo === null);
    if (typeof datos === 'string') {
      this.error.set(datos);
      return;
    }
    if (archivo === null) {
      this.error.set('Elige el PDF que vas a registrar.');
      return;
    }
    this.ocupado.set(true);
    this.error.set(null);
    try {
      let subidaId: string;
      if (this.subidaLista !== null && this.subidaLista.archivo === archivo) {
        subidaId = this.subidaLista.id;
      } else {
        this.progreso.set(0);
        try {
          this.subida = this.servicio.subir(archivo, (avance) => this.progreso.set(avance));
          subidaId = await this.subida.terminada;
        } catch (error: unknown) {
          this.error.set(mensajeDeSubida(error));
          return;
        } finally {
          this.subida = null;
          this.progreso.set(null);
        }
        this.subidaLista = { archivo, id: subidaId };
      }
      const documento = await this.servicio.registrar(this.contexto.id(), subidaId, datos);
      this.subidaLista = null;
      this.contexto.actualizarDocumento(documento);
      prepararFormularioDocumento(this.formulario, seccion, null);
      this.selector()?.limpiar();
      this.avisos.exito('PDF registrado. Se está optimizando.');
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
