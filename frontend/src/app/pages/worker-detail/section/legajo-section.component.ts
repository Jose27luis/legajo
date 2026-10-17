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
  INCORPORACION,
  crearFormularioDocumento,
  leerFormularioDocumento,
  prepararFormularioDocumento,
} from '../../../components/document-fields/document-form';
import { PdfPickerComponent } from '../../../components/pdf-picker/pdf-picker.component';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../../../components/search-select/search-select.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
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

const AVISOS: Record<number, { titulo: string | null; texto: string; sensible: boolean }> = {
  2: {
    titulo: 'Vinculación con la Sección 01:',
    texto:
      'al registrar un contrato o resolución con PDF real, régimen y fecha de inicio, se vincula automáticamente con la ficha y el historial de la Sección 01. Puedes comprobarlo desde Ver detalle; nunca cambia por sí mismo ACTIVO/CESADO. Los CV y declaraciones no actualizan la ficha.',
    sensible: false,
  },
  5: {
    titulo: 'Sección 05:',
    texto:
      'documentación de vacaciones, licencias y permisos. Los desplazamientos como rotaciones, destaque y encargatura corresponden a la Sección 07.',
    sensible: false,
  },
  7: {
    titulo: 'Sección 07 → Sección 01:',
    texto:
      'registra la resolución o memorando y luego pulsa Ver detalle → Confirmar movimiento laboral. Al confirmar se actualizan el área de destino y el último movimiento. Una rotación no cambia ACTIVO/CESADO. Los PDF sin confirmar solo quedan archivados.',
    sensible: false,
  },
  10: {
    titulo: 'Acceso sensible:',
    texto:
      'los documentos de salud ocupacional requieren permisos especiales. No deben exponerse diagnósticos médicos ni datos clínicos en esta ficha.',
    sensible: true,
  },
  11: {
    titulo: 'Desvinculación:',
    texto:
      'registrar un PDF de cese no cambia por sí solo el estado laboral. Abre Ver detalle del PDF sustentatorio y pulsa Confirmar cese laboral para validar motivo y fecha efectiva. La ficha de la Sección 01 se actualizará al confirmar.',
    sensible: false,
  },
  12: {
    titulo: null,
    texto:
      'Usa «Otros documentos» únicamente cuando el archivo no corresponda a ninguna de las otras 12 secciones. Registra una justificación.',
    sensible: false,
  },
};

const AVISO_GENERAL = {
  titulo: null,
  texto:
    'Los documentos de distintos años conservan su estado. Solo se reemplaza al corregir el mismo PDF. La fecha de carga se registra automáticamente.',
  sensible: false,
};

const OPCIONES_ESTADO: readonly OpcionBuscable[] = [
  { valor: null, etiqueta: 'Todos los estados' },
  ...ESTADOS_DOCUMENTO.map((estado) => ({ valor: estado, etiqueta: TEXTO_ESTADO_DOCUMENTO[estado] })),
];

@Component({
  selector: 'app-legajo-section',
  imports: [RouterLink, DocumentFieldsComponent, PdfPickerComponent, DocumentDialogComponent, SkeletonComponent, SearchSelectComponent],
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
  protected readonly opcionesEstado = OPCIONES_ESTADO;
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

  protected readonly incorporacionSugerida = computed(() => {
    const trabajador = this.contexto.detalle.value();
    if (trabajador?.estado === 'CESADO') {
      return INCORPORACION.reingreso;
    }
    const legajo = this.contexto.legajo.hasValue() ? this.contexto.legajo.value() : null;
    const vinculados = (legajo?.documentos ?? []).some(
      (documento) => documento.tipo.accion === 'VINCULO' && documento.vinculoId !== null && documento.estado !== 'ANULADO',
    );
    return vinculados ? INCORPORACION.renovacion : INCORPORACION.primerIngreso;
  });

  protected etiquetasPropias(seccion: SeccionLegajo): string {
    return seccion.campos.map((campo) => campo.etiqueta).join(' · ');
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

  protected alFiltrar(valor: ValorOpcion): void {
    this.filtroEstado.set(this.estados.find((estado) => estado === valor) ?? '');
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
      if (documento.vinculoId !== null) {
        this.contexto.detalle.reload();
        this.avisos.exito('PDF registrado y vinculado automáticamente con la Sección 01.');
      } else if (
        documento.tipo.accion === 'CESE' ||
        (documento.tipo.accion === 'VINCULO' && documento.datos['tipoIncorporacion'] === INCORPORACION.reingreso)
      ) {
        this.seleccionadoId.set(documento.id);
        this.avisos.exito('PDF registrado. Cuando termine de procesarse, confírmalo desde este detalle.');
      } else if (documento.tipo.accion === 'MOVIMIENTO') {
        this.seleccionadoId.set(documento.id);
        this.avisos.exito('PDF registrado. Confirma el movimiento desde este detalle cuando termine de procesarse.');
      } else {
        this.avisos.exito('PDF registrado. Se está optimizando.');
      }
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
