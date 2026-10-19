import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import {
  CLASE_ESTADO_DOCUMENTO,
  MOTIVOS_CESE,
  TEXTO_ESTADO_DOCUMENTO,
  TEXTO_MOTIVO_FIN,
  fechaCorta,
  hoy,
  nombreCompleto,
} from '../../core/labels';
import type { Documento, SeccionLegajo, TrabajadorDetalle, Vinculo } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { DocumentsService, mensajeDeSubida, type SubidaEnCurso } from '../../services/documents.service';
import { DialogComponent } from '../dialog/dialog.component';
import { PdfPickerComponent } from '../pdf-picker/pdf-picker.component';
import { SearchSelectComponent, type OpcionBuscable } from '../search-select/search-select.component';

@Component({
  selector: 'app-period-dialog',
  imports: [ReactiveFormsModule, DialogComponent, PdfPickerComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './period-dialog.component.html',
  styleUrl: './period-dialog.component.css',
})
export class PeriodDialogComponent implements OnDestroy {
  private readonly servicio = inject(DocumentsService);
  private readonly avisos = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly sesion = inject(SessionService);

  readonly vinculo = input<Vinculo | null>(null);
  readonly trabajador = input<TrabajadorDetalle | null>(null);
  readonly documentos = input<Documento[]>([]);
  readonly secciones = input<SeccionLegajo[]>([]);
  readonly cerrar = output();
  readonly registrado = output<Documento>();

  protected readonly textoEstado = TEXTO_ESTADO_DOCUMENTO;
  protected readonly claseEstado = CLASE_ESTADO_DOCUMENTO;
  protected readonly textoMotivoFin = TEXTO_MOTIVO_FIN;
  protected readonly fechaCorta = fechaCorta;
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly hoy = hoy();

  protected readonly esSalida = computed(() => {
    const motivo = this.vinculo()?.motivoFin ?? null;
    return motivo !== null && MOTIVOS_CESE.some((cese) => cese === motivo);
  });
  protected readonly numeroSeccion = computed(() => (this.esSalida() ? 11 : 2));
  protected readonly vinculados = computed(() => {
    const vinculo = this.vinculo();
    return vinculo === null
      ? []
      : this.documentos().filter((documento) => documento.vinculoId === vinculo.id && documento.seccion === this.numeroSeccion());
  });
  protected readonly tiposVinculo = computed(
    () =>
      this.secciones()
        .find((seccion) => seccion.numero === 2)
        ?.tipos.filter((tipo) => tipo.accion === 'VINCULO') ?? [],
  );
  protected readonly opcionesTipo = computed<OpcionBuscable[]>(() =>
    this.tiposVinculo().map((tipo) => ({ valor: tipo.id, etiqueta: tipo.nombre })),
  );
  protected readonly sinEnlazar = computed(() =>
    this.esSalida()
      ? []
      : this.documentos().filter(
          (documento) =>
            documento.seccion === 2 &&
            documento.tipo.accion === 'VINCULO' &&
            documento.vinculoId === null &&
            documento.estado !== 'ANULADO',
        ),
  );
  protected readonly puedeEnlazar = computed(() => this.sesion.tiene('personal.editar'));
  protected readonly enlazando = signal<string | null>(null);
  protected readonly puedeRegistrar = computed(
    () => !this.esSalida() && this.sesion.tiene('documentos.subir') && this.tiposVinculo().length > 0,
  );

  protected readonly registrando = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly progreso = signal<number | null>(null);
  protected readonly archivo = signal<File | null>(null);
  protected readonly archivoFaltante = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formulario = new FormGroup({
    tipoDocumentoId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    numero: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
    fechaEmision: new FormControl('', { nonNullable: true }),
  });

  private subida: SubidaEnCurso | null = null;

  ngOnDestroy(): void {
    this.subida?.cancelar();
  }

  reiniciar(): void {
    this.registrando.set(false);
    this.error.set(null);
    this.archivo.set(null);
    this.archivoFaltante.set(false);
    this.formulario.reset({ tipoDocumentoId: this.tiposVinculo().at(0)?.id ?? null, numero: '', fechaEmision: '' });
  }

  protected enlace(documento: Documento): string {
    return this.servicio.enlaceArchivo(documento.id, false);
  }

  protected nombreArchivo(documento: Documento): string {
    return documento.versiones.find((version) => version.actual)?.nombreOriginal ?? documento.tipo.nombre;
  }

  protected irASeccion(): void {
    const trabajador = this.trabajador();
    if (trabajador !== null) {
      this.cerrar.emit();
      void this.router.navigate(['/workers', trabajador.id, 'sections', this.numeroSeccion()]);
    }
  }

  protected alCerrar(): void {
    if (!this.ocupado()) {
      this.cerrar.emit();
    }
  }

  protected async enlazar(documento: Documento): Promise<void> {
    const vinculo = this.vinculo();
    if (vinculo === null || this.enlazando() !== null) {
      return;
    }
    this.enlazando.set(documento.id);
    this.error.set(null);
    try {
      const actualizado = await this.servicio.enlazarPeriodo(documento.id, vinculo.id);
      this.registrado.emit(actualizado);
      this.avisos.exito('Contrato enlazado al período laboral.');
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.enlazando.set(null);
    }
  }

  protected cancelarRegistro(): void {
    if (!this.ocupado()) {
      this.reiniciar();
    }
  }

  protected async guardar(): Promise<void> {
    const trabajador = this.trabajador();
    const vinculo = this.vinculo();
    const archivo = this.archivo();
    const valores = this.formulario.getRawValue();
    this.archivoFaltante.set(archivo === null);
    if (trabajador === null || vinculo === null) {
      return;
    }
    if (valores.tipoDocumentoId === null) {
      this.error.set('Selecciona el tipo de documento.');
      return;
    }
    const tipo = this.tiposVinculo().find((item) => item.id === valores.tipoDocumentoId);
    if (tipo?.requiereNumero === true && valores.numero.trim() === '') {
      this.error.set('Este tipo de documento exige su número.');
      return;
    }
    if (archivo === null) {
      this.error.set('Debes seleccionar un archivo PDF válido.');
      return;
    }
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
      const documento = await this.servicio.registrar(
        trabajador.id,
        subidaId,
        {
          tipoDocumentoId: valores.tipoDocumentoId,
          numero: valores.numero.trim() === '' ? null : valores.numero.trim(),
          fechaEmision: valores.fechaEmision === '' ? null : valores.fechaEmision,
          fechaVencimiento: null,
          emisor: null,
          observaciones: `Sustento documental del vínculo desde ${fechaCorta(vinculo.fechaInicio)}`,
          ubicacionFisica: null,
          nivelAcceso: 'NORMAL',
          datos: {},
        },
        vinculo.id,
      );
      this.registrado.emit(documento);
      this.avisos.exito('PDF guardado en la Sección 02 y vinculado al período laboral.');
      this.reiniciar();
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
