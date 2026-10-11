import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DialogComponent } from '../../components/dialog/dialog.component';
import { LinkFieldsComponent } from '../../components/link-fields/link-fields.component';
import { crearCamposVinculo, leerCamposVinculo, reiniciarCamposVinculo } from '../../components/link-fields/link-form';
import { ReentryDialogComponent } from '../../components/reentry-dialog/reentry-dialog.component';
import { SituationDialogComponent } from '../../components/situation-dialog/situation-dialog.component';
import { mensajeDeError } from '../../core/errors';
import {
  MOTIVOS_CAMBIO,
  TEXTO_ESTADO,
  TEXTO_MOTIVO_CAMBIO,
  TEXTO_MOVIMIENTO,
  hoy,
  iniciales,
  nombreCompleto,
  numeroSeccion,
  puedeReingresar,
} from '../../core/labels';
import type { MotivoCambio, TipoDocIdentidad, TrabajadorDetalle } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { WorkersService } from '../../services/workers.service';
import { WorkerContext } from './worker-context';

const opcional = (valor: string): string | null => (valor.trim() === '' ? null : valor.trim());

interface EnlaceSeccion {
  numero: number;
  nombre: string;
  ruta: string;
  total: number;
}

@Component({
  selector: 'app-worker-detail',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    DialogComponent,
    LinkFieldsComponent,
    SituationDialogComponent,
    ReentryDialogComponent,
  ],
  providers: [WorkerContext],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './worker-detail.component.html',
  styleUrl: './worker-detail.component.css',
})
export class WorkerDetailComponent {
  private readonly servicio = inject(WorkersService);
  private readonly avisos = inject(ToastService);
  protected readonly contexto = inject(WorkerContext);
  protected readonly sesion = inject(SessionService);

  private readonly situacion = viewChild.required(SituationDialogComponent);
  private readonly reingreso = viewChild.required(ReentryDialogComponent);

  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly textoMotivoCambio = TEXTO_MOTIVO_CAMBIO;
  protected readonly motivosCambio = MOTIVOS_CAMBIO;
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly iniciales = iniciales;
  protected readonly numeroSeccion = numeroSeccion;
  protected readonly puedeReingresar = puedeReingresar;
  protected readonly hoy = hoy();

  protected readonly detalle = this.contexto.detalle;
  protected readonly errorDetalle = computed(() => {
    const error = this.detalle.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly secciones = computed<EnlaceSeccion[]>(() =>
    this.contexto.legajo.hasValue()
      ? this.contexto.legajo.value().secciones.map((seccion) => ({
          numero: seccion.numero,
          nombre: seccion.nombre,
          ruta: `sections/${seccion.numero}`,
          total: seccion.total,
        }))
      : [],
  );

  protected readonly paraSituacion = signal<TrabajadorDetalle | null>(null);
  protected readonly paraReingreso = signal<TrabajadorDetalle | null>(null);

  protected readonly fichaAbierta = signal(false);
  protected readonly guardandoFicha = signal(false);
  protected readonly errorFicha = signal<string | null>(null);
  protected readonly ficha = new FormGroup({
    tipoDocIdentidad: new FormControl<TipoDocIdentidad>('DNI', { nonNullable: true }),
    numeroDoc: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9]{8,12}$/)] }),
    nombres: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    apellidoPaterno: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    apellidoMaterno: new FormControl('', { nonNullable: true }),
    fechaNacimiento: new FormControl('', { nonNullable: true }),
    sexo: new FormControl('', { nonNullable: true }),
    estadoCivil: new FormControl('', { nonNullable: true }),
    direccion: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    departamento: new FormControl('', { nonNullable: true }),
    provincia: new FormControl('', { nonNullable: true }),
    distrito: new FormControl('', { nonNullable: true }),
    telefono: new FormControl('', { nonNullable: true }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    fechaIngreso: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly cambioAbierto = signal(false);
  protected readonly guardandoCambio = signal(false);
  protected readonly errorCambio = signal<string | null>(null);
  protected readonly vinculoCambio = crearCamposVinculo();
  protected readonly fechaCambio = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected readonly motivoCambio = new FormControl<MotivoCambio>('CAMBIO_CARGO_O_AREA', { nonNullable: true });

  protected abrirSituacion(trabajador: TrabajadorDetalle): void {
    this.situacion().reiniciar(trabajador);
    this.paraSituacion.set(trabajador);
  }

  protected abrirReingreso(trabajador: TrabajadorDetalle): void {
    this.reingreso().reiniciar(trabajador);
    this.paraReingreso.set(trabajador);
  }

  protected alActualizar(detalle: TrabajadorDetalle, mensaje: string): void {
    this.paraSituacion.set(null);
    this.paraReingreso.set(null);
    this.detalle.set(detalle);
    this.avisos.exito(mensaje);
  }

  protected abrirFicha(trabajador: TrabajadorDetalle): void {
    this.errorFicha.set(null);
    this.ficha.reset({
      tipoDocIdentidad: trabajador.tipoDocIdentidad,
      numeroDoc: trabajador.numeroDoc,
      nombres: trabajador.nombres,
      apellidoPaterno: trabajador.apellidoPaterno,
      apellidoMaterno: trabajador.apellidoMaterno ?? '',
      fechaNacimiento: trabajador.fechaNacimiento ?? '',
      sexo: trabajador.sexo ?? '',
      estadoCivil: trabajador.estadoCivil ?? '',
      direccion: trabajador.direccion ?? '',
      departamento: trabajador.departamento ?? '',
      provincia: trabajador.provincia ?? '',
      distrito: trabajador.distrito ?? '',
      telefono: trabajador.telefono ?? '',
      correo: trabajador.correo ?? '',
      fechaIngreso: trabajador.fechaIngreso,
    });
    this.fichaAbierta.set(true);
  }

  protected cerrarFicha(): void {
    if (!this.guardandoFicha()) {
      this.fichaAbierta.set(false);
    }
  }

  protected campoInvalido(campo: 'numeroDoc' | 'nombres' | 'apellidoPaterno' | 'correo' | 'fechaIngreso'): boolean {
    const control = this.ficha.controls[campo];
    return control.touched && control.invalid;
  }

  protected async guardarFicha(): Promise<void> {
    if (this.ficha.invalid) {
      this.ficha.markAllAsTouched();
      this.errorFicha.set('Revisa los campos marcados.');
      return;
    }
    const valores = this.ficha.getRawValue();
    this.guardandoFicha.set(true);
    this.errorFicha.set(null);
    try {
      const detalle = await this.servicio.editar(this.contexto.id(), {
        tipoDocIdentidad: valores.tipoDocIdentidad,
        numeroDoc: valores.numeroDoc.trim().toUpperCase(),
        nombres: valores.nombres.trim(),
        apellidoPaterno: valores.apellidoPaterno.trim(),
        apellidoMaterno: opcional(valores.apellidoMaterno),
        fechaNacimiento: opcional(valores.fechaNacimiento),
        sexo: opcional(valores.sexo),
        estadoCivil: opcional(valores.estadoCivil),
        direccion: opcional(valores.direccion),
        departamento: opcional(valores.departamento),
        provincia: opcional(valores.provincia),
        distrito: opcional(valores.distrito),
        telefono: opcional(valores.telefono),
        correo: opcional(valores.correo),
        fechaIngreso: valores.fechaIngreso,
      });
      this.detalle.set(detalle);
      this.fichaAbierta.set(false);
      this.avisos.exito('Ficha actualizada');
    } catch (error: unknown) {
      this.errorFicha.set(mensajeDeError(error));
    } finally {
      this.guardandoFicha.set(false);
    }
  }

  protected abrirCambio(trabajador: TrabajadorDetalle): void {
    this.errorCambio.set(null);
    this.fechaCambio.reset(hoy());
    this.motivoCambio.reset('CAMBIO_CARGO_O_AREA');
    reiniciarCamposVinculo(this.vinculoCambio, trabajador.vinculo);
    this.cambioAbierto.set(true);
  }

  protected cerrarCambio(): void {
    if (!this.guardandoCambio()) {
      this.cambioAbierto.set(false);
    }
  }

  protected async guardarCambio(): Promise<void> {
    const datos = leerCamposVinculo(this.vinculoCambio);
    if (datos === null || this.fechaCambio.invalid) {
      this.vinculoCambio.markAllAsTouched();
      this.errorCambio.set('Completa la fecha y los datos del nuevo vínculo.');
      return;
    }
    this.guardandoCambio.set(true);
    this.errorCambio.set(null);
    try {
      const detalle = await this.servicio.cambiarVinculo(this.contexto.id(), {
        ...datos,
        fechaInicio: this.fechaCambio.value,
        motivo: this.motivoCambio.value,
      });
      this.detalle.set(detalle);
      this.cambioAbierto.set(false);
      this.avisos.exito('Nuevo vínculo registrado');
    } catch (error: unknown) {
      this.errorCambio.set(mensajeDeError(error));
    } finally {
      this.guardandoCambio.set(false);
    }
  }
}
