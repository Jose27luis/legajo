import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogComponent } from '../../../components/dialog/dialog.component';
import { LinkFieldsComponent } from '../../../components/link-fields/link-fields.component';
import { crearCamposVinculo, leerCamposVinculo, reiniciarCamposVinculo } from '../../../components/link-fields/link-form';
import { PeriodDialogComponent } from '../../../components/period-dialog/period-dialog.component';
import { ReentryDialogComponent } from '../../../components/reentry-dialog/reentry-dialog.component';
import { SearchSelectComponent, type OpcionBuscable } from '../../../components/search-select/search-select.component';
import { SituationDialogComponent } from '../../../components/situation-dialog/situation-dialog.component';
import { UbigeoFieldsComponent } from '../../../components/ubigeo-fields/ubigeo-fields.component';
import { crearCamposUbigeo, leerCamposUbigeo, ubicarEnLista } from '../../../components/ubigeo-fields/ubigeo-form';
import { EducationFieldsComponent } from '../../../components/education-fields/education-fields.component';
import { crearCamposFormacion, leerCamposFormacion, reiniciarCamposFormacion } from '../../../components/education-fields/education-form';
import { IdentityDocumentsComponent } from './identity-documents/identity-documents.component';
import { mensajeDeError } from '../../../core/errors';
import { fechaHora } from '../../../core/format';
import {
  MOTIVOS_CAMBIO,
  TEXTO_ESTADO,
  TEXTO_MOTIVO_CAMBIO,
  TEXTO_MOTIVO_FIN,
  TEXTO_MOVIMIENTO,
  TEXTO_TIPO_PERSONAL,
  esSalidaDocumentada,
  fechaCorta,
  hoy,
  puedeReingresar,
  tonoSeccion,
} from '../../../core/labels';
import type {
  Documento,
  Familiar,
  MotivoCambio,
  MovimientoLaboral,
  TipoDocIdentidad,
  TrabajadorDetalle,
  Vinculo,
} from '../../../core/models';
import { SessionService } from '../../../core/session.service';
import { ToastService } from '../../../core/toast.service';
import { UbigeoService } from '../../../services/ubigeo.service';
import { WorkersService } from '../../../services/workers.service';
import { WorkerContext } from '../worker-context';

const opcional = (valor: string): string | null => (valor.trim() === '' ? null : valor.trim());

const VINCULOS_POR_PAGINA = 5;

const OPCIONES_PARENTESCO: readonly OpcionBuscable[] = ['Cónyuge', 'Conviviente', 'Hijo(a)', 'Padre', 'Madre', 'Hermano(a)', 'Otro'].map(
  (parentesco) => ({ valor: parentesco, etiqueta: parentesco }),
);

const OPCIONES_TIPO_DOCUMENTO: readonly OpcionBuscable[] = [
  { valor: 'DNI', etiqueta: 'DNI' },
  { valor: 'CE', etiqueta: 'Carné de extranjería' },
];

const OPCIONES_SEXO: readonly OpcionBuscable[] = [
  { valor: '', etiqueta: 'No registrado' },
  { valor: 'F', etiqueta: 'Femenino' },
  { valor: 'M', etiqueta: 'Masculino' },
];

const OPCIONES_ESTADO_CIVIL: readonly OpcionBuscable[] = [
  { valor: '', etiqueta: 'No registrado' },
  ...['Soltero(a)', 'Casado(a)', 'Conviviente', 'Divorciado(a)', 'Viudo(a)'].map((estado) => ({ valor: estado, etiqueta: estado })),
];

const OPCIONES_MOTIVO_CAMBIO: readonly OpcionBuscable[] = MOTIVOS_CAMBIO.map((motivo) => ({
  valor: motivo,
  etiqueta: TEXTO_MOTIVO_CAMBIO[motivo],
}));

@Component({
  selector: 'app-worker-record',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DialogComponent,
    LinkFieldsComponent,
    SituationDialogComponent,
    ReentryDialogComponent,
    PeriodDialogComponent,
    IdentityDocumentsComponent,
    SearchSelectComponent,
    UbigeoFieldsComponent,
    EducationFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './worker-record.component.html',
  styleUrl: './worker-record.component.css',
})
export class WorkerRecordComponent {
  private readonly servicio = inject(WorkersService);
  private readonly ubigeo = inject(UbigeoService);
  private readonly avisos = inject(ToastService);
  protected readonly contexto = inject(WorkerContext);
  protected readonly sesion = inject(SessionService);

  private readonly situacion = viewChild.required(SituationDialogComponent);
  private readonly reingreso = viewChild.required(ReentryDialogComponent);

  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly textoMotivoFin = TEXTO_MOTIVO_FIN;
  protected readonly textoTipoPersonal = TEXTO_TIPO_PERSONAL;
  protected readonly opcionesParentesco = OPCIONES_PARENTESCO;
  protected readonly opcionesTipoDocumento = OPCIONES_TIPO_DOCUMENTO;
  protected readonly opcionesSexo = OPCIONES_SEXO;
  protected readonly opcionesEstadoCivil = OPCIONES_ESTADO_CIVIL;
  protected readonly opcionesMotivoCambio = OPCIONES_MOTIVO_CAMBIO;
  protected readonly puedeReingresar = puedeReingresar;
  protected readonly fechaCorta = fechaCorta;
  protected readonly fechaHora = fechaHora;
  protected readonly hoy = hoy();

  readonly nuevo = input<string>();

  protected readonly tono = tonoSeccion(1);
  protected readonly paraSituacion = signal<TrabajadorDetalle | null>(null);
  protected readonly paraReingreso = signal<TrabajadorDetalle | null>(null);
  protected readonly periodo = signal<Vinculo | null>(null);
  protected readonly documentosLegajo = computed(() => (this.contexto.legajo.hasValue() ? this.contexto.legajo.value().documentos : []));
  protected readonly seccionesLegajo = computed(() => (this.contexto.legajo.hasValue() ? this.contexto.legajo.value().secciones : []));

  private readonly vinculos = computed(() => (this.contexto.detalle.hasValue() ? this.contexto.detalle.value().vinculos : []));
  protected readonly paginasVinculos = computed(() => Math.max(1, Math.ceil(this.vinculos().length / VINCULOS_POR_PAGINA)));
  protected readonly paginaVinculos = linkedSignal<string | undefined, number>({
    source: () => (this.contexto.detalle.hasValue() ? this.contexto.detalle.value().id : undefined),
    computation: () => 0,
  });
  protected readonly paginaVinculosVigente = computed(() => Math.min(this.paginaVinculos(), this.paginasVinculos() - 1));
  protected readonly vinculosVisibles = computed(() => {
    const inicio = this.paginaVinculosVigente() * VINCULOS_POR_PAGINA;
    return this.vinculos().slice(inicio, inicio + VINCULOS_POR_PAGINA);
  });

  protected cambiarPaginaVinculos(desplazamiento: number): void {
    this.paginaVinculos.set(Math.min(Math.max(this.paginaVinculosVigente() + desplazamiento, 0), this.paginasVinculos() - 1));
  }

  protected ultimoMovimiento(trabajador: TrabajadorDetalle): MovimientoLaboral | null {
    if (trabajador.movimientoActual === 'SIN_MOVIMIENTO') {
      return null;
    }
    return trabajador.movimientos.find((movimiento) => movimiento.tipo === trabajador.movimientoActual) ?? null;
  }

  protected motivoCese(trabajador: TrabajadorDetalle): string {
    const motivo = trabajador.vinculo?.motivoFin ?? null;
    return trabajador.estado === 'CESADO' && motivo !== null ? TEXTO_MOTIVO_FIN[motivo] : 'No corresponde';
  }

  protected esCese(vinculo: Vinculo): boolean {
    return esSalidaDocumentada(vinculo, this.documentosLegajo());
  }

  protected pistaPeriodo(vinculo: Vinculo): string {
    if (this.esCese(vinculo)) {
      return 'Ver sustento del cese · Sección 11';
    }
    const vinculados = this.documentosLegajo().some((documento) => documento.vinculoId === vinculo.id && documento.seccion === 2);
    return vinculados ? 'Ver o actualizar documento sustentatorio · Sección 02' : 'Pulsa aquí para adjuntar documento · Sección 02';
  }

  protected abrirPeriodo(vinculo: Vinculo): void {
    this.periodo.set(vinculo);
  }

  protected alRegistrarSustento(documento: Documento): void {
    this.contexto.actualizarDocumento(documento);
  }

  private async ubicarFicha(trabajador: TrabajadorDetalle): Promise<void> {
    try {
      const lista = await this.ubigeo.cargar();
      this.ficha.controls.ubicacion.setValue(ubicarEnLista(lista, trabajador));
    } catch (error: unknown) {
      this.errorFicha.set(`No se pudo cargar la lista de departamentos. ${mensajeDeError(error)}`);
    }
  }

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
    ubicacion: crearCamposUbigeo(),
    formacion: crearCamposFormacion(),
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
    this.contexto.detalle.set(detalle);
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
      ubicacion: { departamento: '', provincia: '', distrito: '' },
      telefono: trabajador.telefono ?? '',
      correo: trabajador.correo ?? '',
      fechaIngreso: trabajador.fechaIngreso,
    });
    reiniciarCamposFormacion(this.ficha.controls.formacion, trabajador);
    this.fichaAbierta.set(true);
    void this.ubicarFicha(trabajador);
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
        ...leerCamposUbigeo(this.ficha.controls.ubicacion),
        ...leerCamposFormacion(this.ficha.controls.formacion),
        telefono: opcional(valores.telefono),
        correo: opcional(valores.correo),
        fechaIngreso: valores.fechaIngreso,
      });
      this.contexto.detalle.set(detalle);
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
      this.contexto.detalle.set(detalle);
      this.cambioAbierto.set(false);
      this.avisos.exito('Nuevo vínculo registrado');
    } catch (error: unknown) {
      this.errorCambio.set(mensajeDeError(error));
    } finally {
      this.guardandoCambio.set(false);
    }
  }

  protected readonly familiarAbierto = signal(false);
  protected readonly familiarEditando = signal<Familiar | null>(null);
  protected readonly guardandoFamiliar = signal(false);
  protected readonly errorFamiliar = signal<string | null>(null);
  protected readonly familiar = new FormGroup({
    parentesco: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nombresApellidos: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    numeroDoc: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^([A-Za-z0-9]{8,12})?$/)] }),
    fechaNacimiento: new FormControl('', { nonNullable: true }),
  });
  protected readonly porQuitar = signal<Familiar | null>(null);
  protected readonly quitando = signal(false);

  protected ubicacion(trabajador: TrabajadorDetalle): string {
    return [trabajador.distrito, trabajador.provincia, trabajador.departamento]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(', ');
  }

  protected abrirFamiliar(familiar: Familiar | null): void {
    this.familiarEditando.set(familiar);
    this.errorFamiliar.set(null);
    this.familiar.reset({
      parentesco: familiar?.parentesco ?? '',
      nombresApellidos: familiar?.nombresApellidos ?? '',
      numeroDoc: familiar?.numeroDoc ?? '',
      fechaNacimiento: familiar?.fechaNacimiento ?? '',
    });
    this.familiarAbierto.set(true);
  }

  protected cerrarFamiliar(): void {
    if (!this.guardandoFamiliar()) {
      this.familiarAbierto.set(false);
    }
  }

  protected async guardarFamiliar(): Promise<void> {
    if (this.familiar.invalid) {
      this.familiar.markAllAsTouched();
      this.errorFamiliar.set('Revisa los campos marcados.');
      return;
    }
    const valores = this.familiar.getRawValue();
    const datos = {
      parentesco: valores.parentesco,
      nombresApellidos: valores.nombresApellidos.trim(),
      numeroDoc: opcional(valores.numeroDoc),
      fechaNacimiento: opcional(valores.fechaNacimiento),
    };
    const id = this.contexto.id();
    this.guardandoFamiliar.set(true);
    this.errorFamiliar.set(null);
    try {
      const editando = this.familiarEditando();
      if (editando === null) {
        await this.servicio.crearFamiliar(id, datos);
      } else {
        await this.servicio.editarFamiliar(id, editando.id, datos);
      }
      this.contexto.detalle.set(await this.servicio.obtener(id));
      this.familiarAbierto.set(false);
      this.avisos.exito(editando === null ? 'Familiar agregado' : 'Familiar actualizado');
    } catch (error: unknown) {
      this.errorFamiliar.set(mensajeDeError(error));
    } finally {
      this.guardandoFamiliar.set(false);
    }
  }

  protected cerrarQuitar(): void {
    if (!this.quitando()) {
      this.porQuitar.set(null);
    }
  }

  protected async confirmarQuitar(): Promise<void> {
    const familiar = this.porQuitar();
    if (familiar === null) {
      return;
    }
    const id = this.contexto.id();
    this.quitando.set(true);
    try {
      await this.servicio.quitarFamiliar(id, familiar.id);
      this.contexto.detalle.set(await this.servicio.obtener(id));
      this.porQuitar.set(null);
      this.avisos.exito('Familiar quitado');
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.quitando.set(false);
    }
  }
}
