import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDeError } from '../../core/errors';
import { fechaHora } from '../../core/format';
import {
  CLASE_ESTADO_DOCUMENTO,
  TEXTO_ESTADO_DOCUMENTO,
  TEXTO_NIVEL_ACCESO,
  fechaCorta,
  numeroSeccion,
  tamanoLegible,
} from '../../core/labels';
import type { Documento, SeccionLegajo, ValorCampo } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { DocumentsService, mensajeDeSubida, type SubidaEnCurso } from '../../services/documents.service';
import { DialogComponent } from '../dialog/dialog.component';
import { DocumentFieldsComponent } from '../document-fields/document-fields.component';
import { crearFormularioDocumento, leerFormularioDocumento, prepararFormularioDocumento } from '../document-fields/document-form';
import { PdfPickerComponent } from '../pdf-picker/pdf-picker.component';

type Modo = 'detalle' | 'editar' | 'reemplazar' | 'anular';

const TITULOS: Record<Modo, string> = {
  detalle: 'Detalle del documento',
  editar: 'Corregir datos del documento',
  reemplazar: 'Reemplazar el PDF',
  anular: 'Anular documento',
};

@Component({
  selector: 'app-document-dialog',
  imports: [ReactiveFormsModule, DialogComponent, DocumentFieldsComponent, PdfPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-dialog.component.html',
  styleUrl: './document-dialog.component.css',
})
export class DocumentDialogComponent implements OnDestroy {
  private readonly servicio = inject(DocumentsService);
  private readonly avisos = inject(ToastService);
  protected readonly sesion = inject(SessionService);

  readonly documento = input<Documento | null>(null);
  readonly seccion = input<SeccionLegajo | null>(null);
  readonly cerrar = output();
  readonly actualizado = output<Documento>();

  protected readonly textoEstado = TEXTO_ESTADO_DOCUMENTO;
  protected readonly claseEstado = CLASE_ESTADO_DOCUMENTO;
  protected readonly textoNivel = TEXTO_NIVEL_ACCESO;
  protected readonly fechaCorta = fechaCorta;
  protected readonly fechaHora = fechaHora;
  protected readonly tamanoLegible = tamanoLegible;
  protected readonly numeroSeccion = numeroSeccion;

  protected readonly modo = linkedSignal<string | undefined, Modo>({
    source: () => this.documento()?.id,
    computation: () => 'detalle',
  });
  protected readonly titulo = computed(() => TITULOS[this.modo()]);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly progreso = signal<number | null>(null);
  protected readonly archivo = signal<File | null>(null);

  protected readonly formulario = crearFormularioDocumento();
  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
  });

  private subida: SubidaEnCurso | null = null;

  protected readonly versionActual = computed(() => this.documento()?.versiones.find((version) => version.actual) ?? null);

  protected readonly propios = computed(() => {
    const documento = this.documento();
    const seccion = this.seccion();
    if (documento === null || seccion === null) {
      return [];
    }
    return seccion.campos.map((campo) => ({ etiqueta: campo.etiqueta, valor: this.mostrar(documento.datos[campo.clave] ?? null, campo.tipo) }));
  });

  ngOnDestroy(): void {
    this.subida?.cancelar();
  }

  protected enlace(descargar: boolean): string {
    const documento = this.documento();
    return documento === null ? '' : this.servicio.enlaceArchivo(documento.id, descargar);
  }

  protected cambiarModo(modo: Modo): void {
    const documento = this.documento();
    const seccion = this.seccion();
    if (documento === null || seccion === null) {
      return;
    }
    this.error.set(null);
    this.motivo.reset('');
    this.archivo.set(null);
    this.progreso.set(null);
    if (modo === 'editar') {
      prepararFormularioDocumento(this.formulario, seccion, documento);
    }
    this.modo.set(modo);
  }

  protected alCerrar(): void {
    if (this.ocupado()) {
      return;
    }
    this.cerrar.emit();
  }

  protected volver(): void {
    if (!this.ocupado()) {
      this.error.set(null);
      this.modo.set('detalle');
    }
  }

  protected motivoInvalido(): boolean {
    return this.motivo.touched && this.motivo.invalid;
  }

  protected async guardarEdicion(): Promise<void> {
    const documento = this.documento();
    const seccion = this.seccion();
    if (documento === null || seccion === null) {
      return;
    }
    const datos = leerFormularioDocumento(this.formulario, seccion);
    this.motivo.markAsTouched();
    if (typeof datos === 'string') {
      this.error.set(datos);
      return;
    }
    if (this.motivo.invalid) {
      this.error.set('Explica qué se corrigió (mínimo 5 caracteres).');
      return;
    }
    await this.ejecutar(() => this.servicio.editar(documento.id, datos, this.motivo.value.trim()), 'Datos corregidos');
  }

  protected async anular(): Promise<void> {
    const documento = this.documento();
    this.motivo.markAsTouched();
    if (documento === null) {
      return;
    }
    if (this.motivo.invalid) {
      this.error.set('Indica el motivo de la anulación (mínimo 5 caracteres).');
      return;
    }
    await this.ejecutar(() => this.servicio.anular(documento.id, this.motivo.value.trim()), 'Documento anulado');
  }

  protected async reintentar(): Promise<void> {
    const documento = this.documento();
    if (documento !== null) {
      await this.ejecutar(() => this.servicio.reintentar(documento.id), 'Se volvió a enviar a procesar');
    }
  }

  protected async reemplazar(): Promise<void> {
    const documento = this.documento();
    const archivo = this.archivo();
    this.motivo.markAsTouched();
    if (documento === null) {
      return;
    }
    if (archivo === null) {
      this.error.set('Elige el PDF corregido.');
      return;
    }
    if (this.motivo.invalid) {
      this.error.set('Indica por qué se reemplaza (mínimo 5 caracteres).');
      return;
    }
    this.ocupado.set(true);
    this.error.set(null);
    this.progreso.set(0);
    let subidaId: string;
    try {
      this.subida = this.servicio.subir(archivo, (avance) => this.progreso.set(avance));
      subidaId = await this.subida.terminada;
    } catch (error: unknown) {
      this.error.set(mensajeDeSubida(error));
      this.progreso.set(null);
      this.ocupado.set(false);
      return;
    } finally {
      this.subida = null;
    }
    this.ocupado.set(false);
    await this.ejecutar(() => this.servicio.reemplazar(documento.id, subidaId, this.motivo.value.trim()), 'PDF enviado a procesar');
    this.progreso.set(null);
  }

  private async ejecutar(accion: () => Promise<Documento>, mensaje: string): Promise<void> {
    this.ocupado.set(true);
    this.error.set(null);
    try {
      const resultado = await accion();
      this.actualizado.emit(resultado);
      this.modo.set('detalle');
      this.avisos.exito(mensaje);
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.ocupado.set(false);
    }
  }

  private mostrar(valor: ValorCampo, tipo: string): string {
    if (valor === null || valor === '') {
      return 'Sin registrar';
    }
    return tipo === 'fecha' && typeof valor === 'string' ? fechaCorta(valor) : String(valor);
  }
}
