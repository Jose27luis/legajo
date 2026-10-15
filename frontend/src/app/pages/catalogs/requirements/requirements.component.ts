import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent } from '../../../components/dialog/dialog.component';
import { SearchSelectComponent, type OpcionBuscable } from '../../../components/search-select/search-select.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import type { AplicaA, Regimen, Requisito, Seccion, TipoPersonal } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { CatalogsService } from '../../../services/catalogs.service';

const TEXTO_TIPO_PERSONAL: Record<TipoPersonal, string> = {
  ADMINISTRATIVO: 'Administrativo',
  ASISTENCIAL: 'Asistencial',
};

const TEXTO_APLICA_A: Record<AplicaA, string> = {
  TODOS: 'Activos y cesados',
  ACTIVO: 'Solo activos',
  CESADO: 'Solo cesados',
};

const OPCIONES_TIPO_PERSONAL: readonly OpcionBuscable[] = [
  { valor: null, etiqueta: 'Administrativo y asistencial' },
  { valor: 'ADMINISTRATIVO', etiqueta: 'Solo administrativo' },
  { valor: 'ASISTENCIAL', etiqueta: 'Solo asistencial' },
];

const OPCIONES_APLICA_A: readonly OpcionBuscable[] = [
  { valor: 'TODOS', etiqueta: 'Trabajadores activos y cesados' },
  { valor: 'ACTIVO', etiqueta: 'Solo trabajadores activos' },
  { valor: 'CESADO', etiqueta: 'Solo trabajadores cesados' },
];

@Component({
  selector: 'app-requirements',
  imports: [ReactiveFormsModule, DialogComponent, SkeletonComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requirements.component.html',
  styleUrl: './requirements.component.css',
})
export class RequirementsComponent implements OnInit {
  private readonly servicio = inject(CatalogsService);
  private readonly avisos = inject(ToastService);

  protected readonly textoTipoPersonal = TEXTO_TIPO_PERSONAL;
  protected readonly textoAplicaA = TEXTO_APLICA_A;
  protected readonly requisitos = signal<Requisito[]>([]);
  protected readonly secciones = signal<Seccion[]>([]);
  protected readonly regimenes = signal<Regimen[]>([]);
  protected readonly opcionesTipoPersonal = OPCIONES_TIPO_PERSONAL;
  protected readonly opcionesAplicaA = OPCIONES_APLICA_A;
  protected readonly opcionesTipo = computed<OpcionBuscable[]>(() =>
    this.secciones().flatMap((seccion) =>
      seccion.tipos
        .filter((tipo) => tipo.activo)
        .map((tipo) => ({ valor: tipo.id, etiqueta: `${tipo.codigo} ${tipo.nombre}`, detalle: `${seccion.numero}. ${seccion.nombre}` })),
    ),
  );
  protected readonly opcionesRegimen = computed<OpcionBuscable[]>(() => [
    { valor: null, etiqueta: 'Todos los regímenes' },
    ...this.regimenes().map((regimen) => ({ valor: regimen.id, etiqueta: regimen.nombre })),
  ]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);

  protected readonly dialogoAbierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly formulario = new FormGroup({
    tipoDocumentoId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    regimenId: new FormControl<number | null>(null),
    tipoPersonal: new FormControl<TipoPersonal | null>(null),
    aplicaA: new FormControl<AplicaA>('TODOS', { nonNullable: true }),
  });

  protected readonly porQuitar = signal<Requisito | null>(null);
  protected readonly quitando = signal(false);

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      const [requisitos, secciones, regimenes] = await Promise.all([
        this.servicio.requisitos(),
        this.servicio.secciones(),
        this.servicio.regimenes(),
      ]);
      this.requisitos.set(requisitos);
      this.secciones.set(secciones);
      this.regimenes.set(regimenes.filter((regimen) => regimen.activo));
    } catch (error: unknown) {
      this.errorCarga.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nuevo(): void {
    this.errorFormulario.set(null);
    this.formulario.reset({ tipoDocumentoId: null, regimenId: null, tipoPersonal: null, aplicaA: 'TODOS' });
    this.dialogoAbierto.set(true);
  }

  protected cerrar(): void {
    if (!this.guardando()) {
      this.dialogoAbierto.set(false);
    }
  }

  protected async guardar(): Promise<void> {
    const { tipoDocumentoId, regimenId, tipoPersonal, aplicaA } = this.formulario.getRawValue();
    if (tipoDocumentoId === null) {
      this.formulario.markAllAsTouched();
      this.errorFormulario.set('Selecciona el tipo de documento.');
      return;
    }
    this.guardando.set(true);
    this.errorFormulario.set(null);
    try {
      const creado = await this.servicio.crearRequisito({ tipoDocumentoId, regimenId, tipoPersonal, aplicaA });
      this.requisitos.update((lista) => [...lista, creado].sort((a, b) => a.tipoDocumento.codigo.localeCompare(b.tipoDocumento.codigo)));
      this.dialogoAbierto.set(false);
      this.avisos.exito(`${creado.tipoDocumento.nombre} agregado como obligatorio`);
    } catch (error: unknown) {
      this.errorFormulario.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async confirmarQuitar(): Promise<void> {
    const requisito = this.porQuitar();
    if (requisito === null) {
      return;
    }
    this.quitando.set(true);
    try {
      await this.servicio.quitarRequisito(requisito.id);
      this.requisitos.update((lista) => lista.filter((item) => item.id !== requisito.id));
      this.porQuitar.set(null);
      this.avisos.exito(`${requisito.tipoDocumento.nombre} ya no es obligatorio en esas condiciones`);
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.quitando.set(false);
    }
  }

  protected cerrarQuitar(): void {
    if (!this.quitando()) {
      this.porQuitar.set(null);
    }
  }
}
