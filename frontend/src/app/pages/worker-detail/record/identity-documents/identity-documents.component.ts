import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePickerComponent } from '../../../../components/date-picker/date-picker.component';
import { DocumentDialogComponent } from '../../../../components/document-dialog/document-dialog.component';
import { PdfPickerComponent } from '../../../../components/pdf-picker/pdf-picker.component';
import { SearchSelectComponent, type OpcionBuscable } from '../../../../components/search-select/search-select.component';
import { mensajeDeError } from '../../../../core/errors';
import { fechaHora } from '../../../../core/format';
import { CLASE_ESTADO_DOCUMENTO, TEXTO_ESTADO_DOCUMENTO, hoy } from '../../../../core/labels';
import type { Documento } from '../../../../core/models';
import { SessionService } from '../../../../core/session.service';
import { ToastService } from '../../../../core/toast.service';
import { DocumentsService, mensajeDeSubida, type SubidaEnCurso } from '../../../../services/documents.service';
import { WorkerContext } from '../../worker-context';

const CODIGO_DNI = '0102';

@Component({
  selector: 'app-identity-documents',
  imports: [ReactiveFormsModule, PdfPickerComponent, DocumentDialogComponent, SearchSelectComponent, DatePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './identity-documents.component.html',
  styleUrl: './identity-documents.component.css',
})
export class IdentityDocumentsComponent implements OnDestroy {
  private readonly servicio = inject(DocumentsService);
  private readonly avisos = inject(ToastService);
  protected readonly contexto = inject(WorkerContext);
  protected readonly sesion = inject(SessionService);

  protected readonly textoEstado = TEXTO_ESTADO_DOCUMENTO;
  protected readonly claseEstado = CLASE_ESTADO_DOCUMENTO;
  protected readonly fechaHora = fechaHora;
  protected readonly hoy = hoy();

  protected readonly seccion = computed(() =>
    this.contexto.legajo.hasValue() ? (this.contexto.legajo.value().secciones.find((item) => item.numero === 1) ?? null) : null,
  );
  protected readonly tiposDocumento = computed<OpcionBuscable[]>(() =>
    (this.seccion()?.tipos ?? []).map((tipo) => ({ valor: tipo.id, etiqueta: tipo.nombre })),
  );
  protected readonly documentos = computed(() =>
    this.contexto.legajo.hasValue() ? this.contexto.legajo.value().documentos.filter((documento) => documento.seccion === 1) : [],
  );
  protected readonly registrados = computed(() => this.documentos().filter((documento) => documento.estado === 'DISPONIBLE').length);
  protected readonly seleccionadoId = signal<string | null>(null);
  protected readonly seleccionado = computed(() => this.documentos().find((documento) => documento.id === this.seleccionadoId()) ?? null);

  protected readonly archivo = signal<File | null>(null);
  protected readonly archivoFaltante = signal(false);
  protected readonly progreso = signal<number | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmarOtra = signal(false);
  protected readonly formulario = new FormGroup({
    tipoDocumentoId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    fechaEmision: new FormControl('', { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  private subida: SubidaEnCurso | null = null;

  constructor() {
    effect(() => {
      const porDefecto = this.tipoPorDefecto();
      const control = this.formulario.controls.tipoDocumentoId;
      if (porDefecto !== null && control.value === null) {
        control.setValue(porDefecto);
      }
    });
  }

  ngOnDestroy(): void {
    this.subida?.cancelar();
  }

  private readonly tipoPorDefecto = computed(() => {
    const tipos = this.seccion()?.tipos ?? [];
    return tipos.find((tipo) => tipo.codigo === CODIGO_DNI)?.id ?? tipos.at(0)?.id ?? null;
  });

  protected nombreArchivo(documento: Documento): string {
    return documento.versiones.find((version) => version.actual)?.nombreOriginal ?? documento.tipo.nombre;
  }

  protected enlace(documento: Documento, descargar: boolean): string {
    return this.servicio.enlaceArchivo(documento.id, descargar);
  }

  protected async registrar(confirmado = false): Promise<void> {
    const archivo = this.archivo();
    const valores = this.formulario.getRawValue();
    const tipoId = valores.tipoDocumentoId ?? this.tipoPorDefecto();
    this.archivoFaltante.set(archivo === null);
    if (tipoId === null) {
      this.error.set('No hay tipos documentales para esta sección.');
      return;
    }
    if (archivo === null) {
      this.error.set('Adjunta un PDF válido.');
      return;
    }
    const tipo = this.seccion()?.tipos.find((item) => item.id === tipoId);
    const yaHay = this.documentos().some((documento) => documento.tipo.id === tipoId && documento.estado === 'DISPONIBLE');
    if (tipo?.codigo === CODIGO_DNI && yaHay && !confirmado) {
      this.confirmarOtra.set(true);
      return;
    }
    this.confirmarOtra.set(false);
    this.ocupado.set(true);
    this.error.set(null);
    this.progreso.set(0);
    try {
      let subidaId: string;
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
      const documento = await this.servicio.registrar(this.contexto.id(), subidaId, {
        tipoDocumentoId: tipoId,
        numero: null,
        fechaEmision: valores.fechaEmision === '' ? null : valores.fechaEmision,
        fechaVencimiento: null,
        emisor: null,
        observaciones: valores.observaciones.trim() === '' ? null : valores.observaciones.trim(),
        ubicacionFisica: null,
        nivelAcceso: 'NORMAL',
        datos: {},
      });
      this.contexto.actualizarDocumento(documento);
      this.formulario.reset({ tipoDocumentoId: tipoId, fechaEmision: '', observaciones: '' });
      this.archivo.set(null);
      this.archivoFaltante.set(false);
      this.avisos.exito('Documento de identidad incorporado al legajo.');
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
