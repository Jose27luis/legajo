import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogComponent } from '../dialog/dialog.component';
import { LinkFieldsComponent } from '../link-fields/link-fields.component';
import { crearCamposVinculo, leerCamposVinculo, reiniciarCamposVinculo } from '../link-fields/link-form';
import { SearchSelectComponent, type OpcionBuscable } from '../search-select/search-select.component';
import { UbigeoFieldsComponent } from '../ubigeo-fields/ubigeo-fields.component';
import { crearCamposUbigeo, leerCamposUbigeo } from '../ubigeo-fields/ubigeo-form';
import { mensajeDeError } from '../../core/errors';
import { TEXTO_ESTADO, hoy, nombreCompleto, puedeReingresar } from '../../core/labels';
import type { TipoDocIdentidad, TrabajadorDetalle, TrabajadorResumen } from '../../core/models';
import { WorkersService } from '../../services/workers.service';

type CampoTrabajador = 'numeroDoc' | 'nombres' | 'apellidoPaterno' | 'telefono' | 'correo' | 'fechaIngreso';

const opcional = (valor: string): string | null => (valor.trim() === '' ? null : valor.trim());

const OPCIONES_TIPO_DOCUMENTO: readonly OpcionBuscable[] = [
  { valor: 'DNI', etiqueta: 'DNI' },
  { valor: 'CE', etiqueta: 'Carné de extranjería' },
];

@Component({
  selector: 'app-new-worker-dialog',
  imports: [ReactiveFormsModule, RouterLink, DialogComponent, LinkFieldsComponent, SearchSelectComponent, UbigeoFieldsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-worker-dialog.component.html',
  styleUrl: './new-worker-dialog.component.css',
})
export class NewWorkerDialogComponent {
  private readonly servicio = inject(WorkersService);

  readonly abierto = input.required<boolean>();
  readonly cerrar = output();
  readonly creado = output<TrabajadorDetalle>();
  readonly reingresar = output<TrabajadorResumen>();

  protected readonly opcionesTipoDocumento = OPCIONES_TIPO_DOCUMENTO;
  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly puedeReingresar = puedeReingresar;
  protected readonly hoy = hoy();
  protected readonly existente = signal<TrabajadorResumen | null>(null);
  protected readonly disponible = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly vinculo = crearCamposVinculo();
  protected readonly formulario = new FormGroup({
    tipoDocIdentidad: new FormControl<TipoDocIdentidad>('DNI', { nonNullable: true }),
    numeroDoc: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9]{8,12}$/)] }),
    nombres: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    apellidoPaterno: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    apellidoMaterno: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    fechaNacimiento: new FormControl('', { nonNullable: true }),
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^[0-9+() -]{6,20}$/)] }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(120)] }),
    direccion: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    ubicacion: crearCamposUbigeo(),
    fechaIngreso: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private consultaVigente = 0;

  reiniciar(): void {
    this.formulario.reset({
      tipoDocIdentidad: 'DNI',
      numeroDoc: '',
      nombres: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      fechaNacimiento: '',
      telefono: '',
      correo: '',
      direccion: '',
      ubicacion: { departamento: '', provincia: '', distrito: '' },
      fechaIngreso: hoy(),
    });
    reiniciarCamposVinculo(this.vinculo, null);
    this.existente.set(null);
    this.disponible.set(false);
    this.error.set(null);
  }

  protected invalido(campo: CampoTrabajador): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  protected async revisarDocumento(): Promise<void> {
    const tipo = this.formulario.controls.tipoDocIdentidad.value;
    const numero = this.formulario.controls.numeroDoc.value.trim().toUpperCase();
    const completo = tipo === 'DNI' ? /^[0-9]{8}$/.test(numero) : /^[A-Z0-9]{9,12}$/.test(numero);
    this.consultaVigente += 1;
    const consulta = this.consultaVigente;
    this.disponible.set(false);
    if (!completo) {
      this.existente.set(null);
      return;
    }
    try {
      const resultado = await this.servicio.buscarDocumento(tipo, numero);
      if (consulta === this.consultaVigente) {
        this.existente.set(resultado.trabajador);
        this.disponible.set(resultado.trabajador === null);
      }
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    }
  }

  protected cerrarDialogo(): void {
    if (!this.guardando()) {
      this.cerrar.emit();
    }
  }

  protected async guardar(): Promise<void> {
    const datosVinculo = leerCamposVinculo(this.vinculo);
    const valoresDocumento = this.formulario.getRawValue();
    if (valoresDocumento.tipoDocIdentidad === 'DNI' && !/^[0-9]{8}$/.test(valoresDocumento.numeroDoc.trim())) {
      this.formulario.controls.numeroDoc.markAsTouched();
      this.error.set('El DNI debe contener exactamente 8 dígitos.');
      return;
    }
    if (this.formulario.invalid || datosVinculo === null) {
      this.formulario.markAllAsTouched();
      this.vinculo.markAllAsTouched();
      this.error.set('Completa todos los campos obligatorios.');
      return;
    }
    if (this.existente() !== null) {
      this.error.set('Este DNI ya tiene un legajo. Utiliza la ficha existente.');
      return;
    }
    const valores = this.formulario.getRawValue();
    if (valores.fechaIngreso > hoy()) {
      this.error.set('Para un trabajador que ya ingresó, la fecha de ingreso no puede ser futura.');
      return;
    }
    if (valores.fechaNacimiento !== '' && valores.fechaNacimiento > hoy()) {
      this.error.set('La fecha de nacimiento no puede ser futura.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const creado = await this.servicio.crear({
        ...datosVinculo,
        tipoDocIdentidad: valores.tipoDocIdentidad,
        numeroDoc: valores.numeroDoc.trim().toUpperCase(),
        nombres: valores.nombres.trim(),
        apellidoPaterno: valores.apellidoPaterno.trim(),
        apellidoMaterno: opcional(valores.apellidoMaterno),
        fechaNacimiento: opcional(valores.fechaNacimiento),
        telefono: opcional(valores.telefono),
        correo: opcional(valores.correo),
        direccion: opcional(valores.direccion),
        ...leerCamposUbigeo(this.formulario.controls.ubicacion),
        fechaIngreso: valores.fechaIngreso,
      });
      this.creado.emit(creado);
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}
