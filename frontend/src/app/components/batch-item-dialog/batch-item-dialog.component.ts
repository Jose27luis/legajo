import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDeError } from '../../core/errors';
import { numeroSeccion, tamanoLegible } from '../../core/labels';
import type { ItemLote, ParteDivision, SeccionLegajo } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { BatchesService } from '../../services/batches.service';
import { DialogComponent } from '../dialog/dialog.component';
import { DocumentFieldsComponent } from '../document-fields/document-fields.component';
import {
  crearFormularioDocumento,
  leerFormularioDocumento,
  prepararFormularioDocumento,
  type FormularioDocumento,
} from '../document-fields/document-form';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../search-select/search-select.component';
import { WorkerPickerComponent } from '../worker-picker/worker-picker.component';

type Pestana = 'clasificar' | 'dividir' | 'descartar' | 'eliminar';

export interface ItemEliminado {
  itemId: string;
  loteEliminado: boolean;
}

const MINIMO_MOTIVO_ELIMINAR = 10;

interface Rango {
  clave: number;
  desde: FormControl<number>;
  hasta: FormControl<number>;
  trabajadorId: string | null;
  seccionId: number | null;
  formulario: FormularioDocumento;
}

@Component({
  selector: 'app-batch-item-dialog',
  imports: [ReactiveFormsModule, DialogComponent, DocumentFieldsComponent, WorkerPickerComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './batch-item-dialog.component.html',
  styleUrl: './batch-item-dialog.component.css',
})
export class BatchItemDialogComponent {
  private readonly servicio = inject(BatchesService);
  private readonly avisos = inject(ToastService);

  readonly item = input<ItemLote | null>(null);
  readonly loteId = input.required<string>();
  readonly secciones = input.required<SeccionLegajo[]>();
  readonly cerrar = output();
  readonly actualizado = output<ItemLote>();
  readonly eliminado = output<ItemEliminado>();

  protected readonly tamanoLegible = tamanoLegible;
  protected readonly minimoMotivoEliminar = MINIMO_MOTIVO_ELIMINAR;

  protected readonly pendiente = computed(() => this.item()?.estado === 'PENDIENTE');

  protected readonly pestana = linkedSignal<string | undefined, Pestana>({
    source: () => this.item()?.id,
    computation: () => (this.item()?.estado === 'PENDIENTE' ? 'clasificar' : 'eliminar'),
  });
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly trabajador = linkedSignal<string | undefined, { id: string; numeroDoc: string; nombre: string } | null>({
    source: () => this.item()?.id,
    computation: () => null,
  });
  protected readonly seccionId = linkedSignal<string | undefined, number | null>({
    source: () => this.item()?.id,
    computation: () => null,
  });
  protected readonly formulario = crearFormularioDocumento();

  protected readonly rangos = linkedSignal<string | undefined, Rango[]>({
    source: () => this.item()?.id,
    computation: () => [],
  });
  private siguienteClave = 1;

  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5), Validators.maxLength(300)],
  });

  protected readonly opcionesSeccion = computed<OpcionBuscable[]>(() =>
    this.secciones().map((seccion) => ({ valor: seccion.id, etiqueta: `${numeroSeccion(seccion.numero)} ${seccion.nombre}` })),
  );

  protected readonly seccion = computed(() => this.secciones().find((item) => item.id === this.seccionId()) ?? null);

  protected enlace(): string {
    const item = this.item();
    return item === null ? '' : this.servicio.enlaceArchivo(this.loteId(), item.id);
  }

  protected alCerrar(): void {
    if (!this.ocupado()) {
      this.cerrar.emit();
    }
  }

  protected cambiarPestana(pestana: Pestana): void {
    this.error.set(null);
    this.motivo.reset('');
    if (pestana === 'dividir' && this.rangos().length === 0) {
      this.agregarRango();
    }
    this.pestana.set(pestana);
  }

  protected elegirSeccion(valor: ValorOpcion): void {
    const seccion = this.secciones().find((item) => item.id === valor) ?? null;
    this.seccionId.set(seccion?.id ?? null);
    if (seccion !== null) {
      prepararFormularioDocumento(this.formulario, seccion, null);
    }
  }

  protected seccionDeRango(rango: Rango): SeccionLegajo | null {
    return this.secciones().find((item) => item.id === rango.seccionId) ?? null;
  }

  protected elegirSeccionRango(rango: Rango, valor: ValorOpcion): void {
    const seccion = this.secciones().find((item) => item.id === valor) ?? null;
    if (seccion !== null) {
      prepararFormularioDocumento(rango.formulario, seccion, null);
    }
    this.rangos.update((lista) => lista.map((item) => (item.clave === rango.clave ? { ...item, seccionId: seccion?.id ?? null } : item)));
  }

  protected elegirTrabajadorRango(rango: Rango, elegido: { id: string } | null): void {
    this.rangos.update((lista) =>
      lista.map((item) => (item.clave === rango.clave ? { ...item, trabajadorId: elegido?.id ?? null } : item)),
    );
  }

  protected agregarRango(): void {
    const ultimo = this.rangos().at(-1);
    const desde = ultimo === undefined ? 1 : ultimo.hasta.value + 1;
    this.rangos.update((lista) => [
      ...lista,
      {
        clave: this.siguienteClave++,
        desde: new FormControl(desde, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
        hasta: new FormControl(desde, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
        trabajadorId: this.trabajador()?.id ?? null,
        seccionId: null,
        formulario: crearFormularioDocumento(),
      },
    ]);
  }

  protected quitarRango(clave: number): void {
    this.rangos.update((lista) => lista.filter((rango) => rango.clave !== clave));
  }

  protected async clasificar(): Promise<void> {
    const item = this.item();
    const seccion = this.seccion();
    const trabajador = this.trabajador();
    if (item === null || this.ocupado()) {
      return;
    }
    if (trabajador === null) {
      this.error.set('Elige el trabajador al que pertenece el documento.');
      return;
    }
    if (seccion === null) {
      this.error.set('Elige la sección del legajo.');
      return;
    }
    const datos = leerFormularioDocumento(this.formulario, seccion);
    if (typeof datos === 'string') {
      this.error.set(datos);
      return;
    }
    await this.ejecutar(() => this.servicio.clasificar(this.loteId(), item.id, trabajador.id, datos), 'Documento clasificado');
  }

  protected async dividir(): Promise<void> {
    const item = this.item();
    if (item === null || this.ocupado()) {
      return;
    }
    const lista = this.rangos();
    if (lista.length === 0) {
      this.error.set('Agrega al menos un rango de páginas.');
      return;
    }
    const partes: ParteDivision[] = [];
    for (const rango of lista) {
      const seccion = this.seccionDeRango(rango);
      if (rango.trabajadorId === null) {
        this.error.set(`Elige el trabajador del rango ${rango.desde.value}-${rango.hasta.value}.`);
        return;
      }
      if (seccion === null) {
        this.error.set(`Elige la sección del rango ${rango.desde.value}-${rango.hasta.value}.`);
        return;
      }
      if (rango.desde.value > rango.hasta.value) {
        this.error.set('La página inicial no puede ser mayor que la final.');
        return;
      }
      const datos = leerFormularioDocumento(rango.formulario, seccion);
      if (typeof datos === 'string') {
        this.error.set(`Rango ${rango.desde.value}-${rango.hasta.value}: ${datos}`);
        return;
      }
      partes.push({ ...datos, trabajadorId: rango.trabajadorId, desde: rango.desde.value, hasta: rango.hasta.value });
    }
    await this.ejecutar(() => this.servicio.dividir(this.loteId(), item.id, partes), `PDF dividido en ${partes.length} documentos`);
  }

  protected async descartar(): Promise<void> {
    const item = this.item();
    this.motivo.markAsTouched();
    if (item === null || this.ocupado()) {
      return;
    }
    if (this.motivo.invalid) {
      this.error.set('Indica el motivo (mínimo 5 caracteres).');
      return;
    }
    await this.ejecutar(() => this.servicio.descartar(this.loteId(), item.id, this.motivo.value.trim()), 'Archivo descartado');
  }

  protected async eliminar(): Promise<void> {
    const item = this.item();
    this.motivo.markAsTouched();
    if (item === null || this.ocupado()) {
      return;
    }
    const motivo = this.motivo.value.trim();
    if (motivo.length < MINIMO_MOTIVO_ELIMINAR) {
      this.error.set(`Indica el motivo (mínimo ${MINIMO_MOTIVO_ELIMINAR} caracteres).`);
      return;
    }
    this.ocupado.set(true);
    this.error.set(null);
    try {
      const resultado = await this.servicio.eliminar(this.loteId(), item.id, motivo);
      this.avisos.exito(resultado.loteEliminado ? 'Archivo eliminado. El lote quedó vacío y también se eliminó.' : 'Archivo eliminado');
      this.eliminado.emit({ itemId: item.id, loteEliminado: resultado.loteEliminado });
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected motivoInvalido(): boolean {
    return this.motivo.touched && this.motivo.invalid;
  }

  private async ejecutar(accion: () => Promise<ItemLote>, mensaje: string): Promise<void> {
    this.ocupado.set(true);
    this.error.set(null);
    try {
      this.actualizado.emit(await accion());
      this.avisos.exito(mensaje);
      this.cerrar.emit();
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.ocupado.set(false);
    }
  }
}
