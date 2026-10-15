import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { mensajeDeError } from '../../core/errors';
import { fechaHora } from '../../core/format';
import {
  CLASE_ESTADO_DOCUMENTO,
  MOTIVOS_CESE,
  MOVIMIENTOS_REALES,
  TEXTO_ESTADO_DOCUMENTO,
  TEXTO_MOTIVO_CESE,
  TEXTO_MOVIMIENTO,
  TEXTO_NIVEL_ACCESO,
  fechaCorta,
  hoy,
  nombreCompleto,
  numeroSeccion,
  tamanoLegible,
} from '../../core/labels';
import type { CampoSeccion, Documento, MotivoCese, Movimiento, SeccionLegajo, TrabajadorDetalle, ValorCampo } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { DocumentsService, mensajeDeSubida, type SubidaEnCurso } from '../../services/documents.service';
import { LinkOptionsService } from '../../services/link-options.service';
import { DialogComponent } from '../dialog/dialog.component';
import { DocumentFieldsComponent } from '../document-fields/document-fields.component';
import {
  INCORPORACION,
  camposDelDocumento,
  crearFormularioDocumento,
  leerFormularioDocumento,
  prepararFormularioDocumento,
} from '../document-fields/document-form';
import { PdfPickerComponent } from '../pdf-picker/pdf-picker.component';
import { SearchSelectComponent, type OpcionBuscable } from '../search-select/search-select.component';

type Modo = 'detalle' | 'editar' | 'reemplazar' | 'anular' | 'visor' | 'movimiento' | 'cese' | 'reingreso';
type MovimientoReal = Exclude<Movimiento, 'SIN_MOVIMIENTO'>;

const TITULOS: Record<Modo, string> = {
  detalle: 'Detalle del documento',
  editar: 'Modificar datos del PDF',
  reemplazar: 'Reemplazar el mismo PDF',
  anular: 'Anular PDF',
  visor: 'Visor de PDF',
  movimiento: 'Confirmar movimiento laboral · Sección 05',
  cese: 'Confirmar cese laboral · Sección 11',
  reingreso: 'Confirmar reingreso laboral · Sección 02',
};

const MINIMO_MOTIVO = 10;

const OPCIONES_MOVIMIENTO: readonly OpcionBuscable[] = MOVIMIENTOS_REALES.map((movimiento) => ({
  valor: movimiento,
  etiqueta: TEXTO_MOVIMIENTO[movimiento],
}));

const OPCIONES_MOTIVO_CESE: readonly OpcionBuscable[] = MOTIVOS_CESE.map((motivo) => ({
  valor: motivo,
  etiqueta: TEXTO_MOTIVO_CESE[motivo],
}));

function texto(valor: ValorCampo | undefined): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

function numero(valor: ValorCampo | undefined): number | null {
  return typeof valor === 'number' ? valor : null;
}

@Component({
  selector: 'app-document-dialog',
  imports: [ReactiveFormsModule, DialogComponent, DocumentFieldsComponent, PdfPickerComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-dialog.component.html',
  styleUrl: './document-dialog.component.css',
})
export class DocumentDialogComponent implements OnDestroy {
  private readonly servicio = inject(DocumentsService);
  private readonly avisos = inject(ToastService);
  private readonly opcionesVinculo = inject(LinkOptionsService);
  private readonly sanitizador = inject(DomSanitizer);
  protected readonly sesion = inject(SessionService);

  readonly documento = input<Documento | null>(null);
  readonly seccion = input<SeccionLegajo | null>(null);
  readonly trabajador = input<TrabajadorDetalle | null>(null);
  readonly cerrar = output();
  readonly actualizado = output<Documento>();
  readonly fichaActualizada = output();

  protected readonly textoEstado = TEXTO_ESTADO_DOCUMENTO;
  protected readonly claseEstado = CLASE_ESTADO_DOCUMENTO;
  protected readonly textoNivel = TEXTO_NIVEL_ACCESO;
  protected readonly opcionesMovimiento = OPCIONES_MOVIMIENTO;
  protected readonly opcionesMotivoCese = OPCIONES_MOTIVO_CESE;
  protected readonly movimientos = MOVIMIENTOS_REALES;
  protected readonly motivos = MOTIVOS_CESE;
  protected readonly fechaCorta = fechaCorta;
  protected readonly fechaHora = fechaHora;
  protected readonly tamanoLegible = tamanoLegible;
  protected readonly numeroSeccion = numeroSeccion;
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly hoy = hoy();
  protected readonly minimoMotivo = MINIMO_MOTIVO;

  protected readonly modo = linkedSignal<string | undefined, Modo>({
    source: () => this.documento()?.id,
    computation: () => 'detalle',
  });
  protected readonly titulo = computed(() => {
    const modo = this.modo();
    const documento = this.documento();
    return modo === 'visor' && documento !== null
      ? `Visor de PDF · ${this.versionActual()?.nombreOriginal ?? documento.tipo.nombre}`
      : TITULOS[modo];
  });
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly progreso = signal<number | null>(null);
  protected readonly archivo = signal<File | null>(null);
  protected readonly areas = computed<OpcionBuscable[]>(() =>
    (this.opcionesVinculo.opciones()?.areas ?? []).map((area) => ({ valor: area.id, etiqueta: area.nombre, detalle: area.padreNombre })),
  );

  protected readonly formulario = crearFormularioDocumento();
  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });
  protected readonly confirmacionMovimiento = new FormGroup({
    tipo: new FormControl<MovimientoReal | null>(null, { validators: [Validators.required] }),
    fecha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    areaOrigenId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    areaDestinoId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    observacion: new FormControl('', { nonNullable: true }),
  });
  protected readonly confirmacionCese = new FormGroup({
    motivo: new FormControl<MotivoCese | null>(null, { validators: [Validators.required] }),
    fecha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    observacion: new FormControl('', { nonNullable: true }),
  });

  private subida: SubidaEnCurso | null = null;

  protected readonly historial = resource({
    params: () => {
      const documento = this.documento();
      return documento === null ? undefined : { id: documento.id, version: documento.modificadoEn ?? documento.estado };
    },
    loader: ({ params }) => this.servicio.historial(params.id),
  });
  protected readonly cambios = computed(() =>
    this.historial.hasValue() ? this.historial.value().filter((entrada) => entrada.evento !== 'Registrado') : [],
  );

  protected readonly versionActual = computed(() => this.documento()?.versiones.find((version) => version.actual) ?? null);
  protected readonly visor = computed<SafeResourceUrl | null>(() => {
    const documento = this.documento();
    return documento === null || this.versionActual() === null
      ? null
      : this.sanitizador.bypassSecurityTrustResourceUrl(this.servicio.enlaceArchivo(documento.id, false));
  });

  protected readonly propios = computed(() => {
    const documento = this.documento();
    const seccion = this.seccion();
    if (documento === null || seccion === null) {
      return [];
    }
    const tipo = seccion.tipos.find((item) => item.id === documento.tipo.id) ?? documento.tipo;
    return camposDelDocumento(seccion, tipo).map((campo) => ({
      etiqueta: campo.etiqueta,
      valor: this.mostrar(campo, documento.datos[campo.clave] ?? null),
    }));
  });

  protected readonly puedeConfirmar = computed(() => this.sesion.tiene('personal.editar'));
  protected readonly incorporacion = computed(() => texto(this.documento()?.datos['tipoIncorporacion']));
  protected readonly accionPendiente = computed<'vincular' | 'reingreso' | 'movimiento' | 'cese' | null>(() => {
    const documento = this.documento();
    if (documento === null || documento.estado === 'ANULADO' || !this.puedeConfirmar()) {
      return null;
    }
    switch (documento.tipo.accion) {
      case 'VINCULO':
        if (this.incorporacion() === INCORPORACION.reingreso) {
          return documento.confirmadoEn === null ? 'reingreso' : null;
        }
        return this.incorporacion() === INCORPORACION.primerIngreso && documento.vinculoId === null ? 'vincular' : null;
      case 'MOVIMIENTO':
        return documento.movimientoId === null ? 'movimiento' : null;
      case 'CESE':
        return documento.confirmadoEn === null ? 'cese' : null;
      default:
        return null;
    }
  });
  protected readonly confirmado = computed<string | null>(() => {
    const documento = this.documento();
    if (documento === null) {
      return null;
    }
    if (documento.tipo.accion === 'MOVIMIENTO' && documento.movimientoId !== null) {
      return 'Movimiento confirmado · Sección 01';
    }
    if (documento.tipo.accion === 'CESE' && documento.confirmadoEn !== null) {
      return 'Cese confirmado · Sección 01';
    }
    if (documento.tipo.accion === 'VINCULO' && documento.confirmadoEn !== null) {
      return 'Reingreso confirmado · ACTIVO';
    }
    if (documento.tipo.accion === 'VINCULO' && documento.vinculoId !== null) {
      return 'Vinculado a Sección 01';
    }
    return null;
  });
  protected readonly datosReingreso = computed(() => {
    const documento = this.documento();
    const opciones = this.opcionesVinculo.opciones();
    if (documento === null) {
      return null;
    }
    const regimen = numero(documento.datos['regimen']);
    return {
      inicio: texto(documento.datos['inicio']),
      regimen: opciones?.regimenes.find((item) => item.id === regimen)?.nombre ?? null,
    };
  });

  constructor() {
    void this.opcionesVinculo.cargar();
  }

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
    if (modo === 'movimiento') {
      this.prepararMovimiento(documento);
    }
    if (modo === 'cese') {
      this.prepararCese(documento);
    }
    this.modo.set(modo);
  }

  protected alCerrar(): void {
    if (!this.ocupado()) {
      this.cerrar.emit();
    }
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
    const datos = leerFormularioDocumento(this.formulario, seccion, true);
    this.motivo.markAsTouched();
    if (typeof datos === 'string') {
      this.error.set(datos);
      return;
    }
    if (this.motivo.value.trim().length < 5) {
      this.error.set('Explica qué dato se corrigió (mínimo 5 caracteres).');
      return;
    }
    await this.ejecutar(
      () => this.servicio.editar(documento.id, datos, this.motivo.value.trim()),
      'Datos modificados. La fecha original de carga se conserva.',
    );
  }

  protected async anular(): Promise<void> {
    const documento = this.documento();
    this.motivo.markAsTouched();
    if (documento === null) {
      return;
    }
    if (this.motivo.value.trim().length < MINIMO_MOTIVO) {
      this.error.set(`Ingresa un motivo de al menos ${MINIMO_MOTIVO} caracteres.`);
      return;
    }
    await this.ejecutar(() => this.servicio.anular(documento.id, this.motivo.value.trim()), 'Documento anulado y conservado en la lista.');
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
      this.error.set('Selecciona el PDF corregido.');
      return;
    }
    if (this.motivo.value.trim().length < MINIMO_MOTIVO) {
      this.error.set(`Ingresa un motivo de al menos ${MINIMO_MOTIVO} caracteres.`);
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
    await this.ejecutar(
      () => this.servicio.reemplazar(documento.id, subidaId, this.motivo.value.trim()),
      'Versión corregida registrada; la anterior queda en el historial.',
    );
    this.progreso.set(null);
  }

  protected async vincular(): Promise<void> {
    const documento = this.documento();
    if (documento !== null) {
      await this.ejecutar(
        () => this.servicio.vincular(documento.id),
        'Sección 02 vinculada a la ficha y al historial de la Sección 01.',
        true,
      );
    }
  }

  protected async confirmarReingreso(): Promise<void> {
    const documento = this.documento();
    if (documento !== null) {
      await this.ejecutar(
        () => this.servicio.confirmarReingreso(documento.id),
        'Reingreso confirmado: trabajador ACTIVO, historial anterior conservado.',
        true,
      );
    }
  }

  protected async confirmarMovimiento(): Promise<void> {
    const documento = this.documento();
    this.confirmacionMovimiento.markAllAsTouched();
    const valores = this.confirmacionMovimiento.getRawValue();
    if (documento === null) {
      return;
    }
    if (valores.tipo === null || valores.fecha === '' || valores.areaOrigenId === null || valores.areaDestinoId === null) {
      this.error.set('Completa el tipo, la fecha, el área de origen y el área de destino.');
      return;
    }
    if (valores.fecha > this.hoy) {
      this.error.set('La fecha efectiva es futura. Conserva el PDF y confirma el movimiento cuando tenga efecto.');
      return;
    }
    const datos = {
      tipo: valores.tipo,
      fecha: valores.fecha,
      areaOrigenId: valores.areaOrigenId,
      areaDestinoId: valores.areaDestinoId,
      observacion: valores.observacion.trim() === '' ? null : valores.observacion.trim(),
    };
    await this.ejecutar(
      () => this.servicio.confirmarMovimiento(documento.id, datos),
      'Movimiento confirmado. Se actualizaron la Sección 01 y el detalle de movimiento.',
      true,
    );
  }

  protected async confirmarCese(): Promise<void> {
    const documento = this.documento();
    this.confirmacionCese.markAllAsTouched();
    const valores = this.confirmacionCese.getRawValue();
    if (documento === null) {
      return;
    }
    if (valores.motivo === null || valores.fecha === '') {
      this.error.set('Indica el motivo y la fecha efectiva del cese.');
      return;
    }
    if (valores.fecha > this.hoy) {
      this.error.set('El cese aún no es efectivo. Confírmalo a partir de la fecha indicada.');
      return;
    }
    const datos = {
      motivo: valores.motivo,
      fecha: valores.fecha,
      observacion: valores.observacion.trim() === '' ? null : valores.observacion.trim(),
    };
    await this.ejecutar(
      () => this.servicio.confirmarCese(documento.id, datos),
      'Cese confirmado. Sección 01 e historial actualizados.',
      true,
    );
  }

  private prepararMovimiento(documento: Documento): void {
    const etiqueta = texto(documento.datos['tipoMovimiento']);
    const porEtiqueta = this.movimientos.find((movimiento) => TEXTO_MOVIMIENTO[movimiento] === etiqueta);
    const nombre = documento.tipo.nombre.toLowerCase();
    const porNombre = this.movimientos.find((movimiento) => nombre.includes(TEXTO_MOVIMIENTO[movimiento].toLowerCase()));
    this.confirmacionMovimiento.reset({
      tipo: porEtiqueta ?? porNombre ?? null,
      fecha: texto(documento.datos['fechaEfecto']) ?? documento.fechaEmision ?? '',
      areaOrigenId: numero(documento.datos['areaOrigen']) ?? this.trabajador()?.vinculo?.area.id ?? null,
      areaDestinoId: numero(documento.datos['areaDestino']),
      observacion: '',
    });
  }

  private prepararCese(documento: Documento): void {
    const etiqueta = texto(documento.datos['motivoCese']);
    const porEtiqueta = this.motivos.find((motivo) => TEXTO_MOTIVO_CESE[motivo] === etiqueta);
    const nombre = documento.tipo.nombre.toLowerCase();
    const porNombre: MotivoCese | null = nombre.includes('renuncia')
      ? 'RENUNCIA'
      : nombre.includes('jubilaci')
        ? 'JUBILACION'
        : nombre.includes('fallecimiento')
          ? 'FALLECIMIENTO'
          : nombre.includes('término de contrato')
            ? 'FIN_CONTRATO'
            : null;
    this.confirmacionCese.reset({
      motivo: porEtiqueta ?? porNombre,
      fecha: texto(documento.datos['fechaCese']) ?? '',
      observacion: '',
    });
  }

  private async ejecutar(accion: () => Promise<Documento>, mensaje: string, cambiaFicha = false): Promise<void> {
    this.ocupado.set(true);
    this.error.set(null);
    try {
      const resultado = await accion();
      this.actualizado.emit(resultado);
      if (cambiaFicha) {
        this.fichaActualizada.emit();
      }
      this.modo.set('detalle');
      this.historial.reload();
      this.avisos.exito(mensaje);
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.ocupado.set(false);
    }
  }

  private mostrar(campo: CampoSeccion, valor: ValorCampo): string {
    if (valor === null || valor === '') {
      return '—';
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
