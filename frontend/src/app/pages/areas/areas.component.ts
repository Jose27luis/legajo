import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent } from '../../components/dialog/dialog.component';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../../components/search-select/search-select.component';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../core/errors';
import { normalizarTexto } from '../../core/format';
import type { Area } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { CatalogsService } from '../../services/catalogs.service';

type FiltroEstado = 'activas' | 'inactivas' | 'todas';

const OPCIONES_ESTADO: readonly OpcionBuscable[] = [
  { valor: 'activas', etiqueta: 'Activas' },
  { valor: 'inactivas', etiqueta: 'Inactivas' },
  { valor: 'todas', etiqueta: 'Todas' },
];

const FILTROS: readonly FiltroEstado[] = ['activas', 'inactivas', 'todas'];

@Component({
  selector: 'app-areas',
  imports: [ReactiveFormsModule, DialogComponent, SkeletonComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './areas.component.html',
  styleUrl: './areas.component.css',
})
export class AreasComponent implements OnInit {
  private readonly servicio = inject(CatalogsService);
  private readonly avisos = inject(ToastService);

  protected readonly areas = signal<Area[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly dialogoAbierto = signal(false);
  protected readonly editando = signal<Area | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly busqueda = signal('');
  protected readonly estado = signal<FiltroEstado>('activas');
  protected readonly opcionesEstado = OPCIONES_ESTADO;

  protected readonly resumen = computed(() => {
    const areas = this.areas();
    return {
      activas: areas.filter((area) => area.activo).length,
      inactivas: areas.filter((area) => !area.activo).length,
      dependencias: new Set(areas.filter((area) => area.activo && area.padreId !== null).map((area) => area.padreId)).size,
    };
  });

  protected readonly visibles = computed(() => {
    const termino = normalizarTexto(this.busqueda());
    const estado = this.estado();
    return this.areas()
      .filter((area) => estado === 'todas' || area.activo === (estado === 'activas'))
      .filter((area) => termino === '' || normalizarTexto(`${area.nombre} ${area.padreNombre ?? ''}`).includes(termino))
      .sort((a, b) => (a.padreNombre ?? '').localeCompare(b.padreNombre ?? '') || a.nombre.localeCompare(b.nombre));
  });

  protected readonly opcionesPadre = computed<OpcionBuscable[]>(() => {
    const actual = this.editando();
    return [
      { valor: null, etiqueta: 'Ninguna' },
      ...this.areas()
        .filter((area) => area.activo && area.id !== actual?.id)
        .map((area) => ({ valor: area.id, etiqueta: area.nombre, detalle: area.padreNombre })),
    ];
  });
  protected readonly formulario = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(140)],
    }),
    padreId: new FormControl<number | null>(null),
  });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      this.areas.set(await this.servicio.areas());
    } catch (error: unknown) {
      this.errorCarga.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected buscar(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.busqueda.set(evento.target.value);
    }
  }

  protected filtrar(valor: ValorOpcion): void {
    this.estado.set(FILTROS.find((filtro) => filtro === valor) ?? 'activas');
  }

  protected nuevo(): void {
    this.editando.set(null);
    this.errorFormulario.set(null);
    this.formulario.reset({ nombre: '', padreId: null });
    this.dialogoAbierto.set(true);
  }

  protected editar(area: Area): void {
    this.editando.set(area);
    this.errorFormulario.set(null);
    this.formulario.reset({ nombre: area.nombre, padreId: area.padreId });
    this.dialogoAbierto.set(true);
  }

  protected cerrar(): void {
    if (!this.guardando()) {
      this.dialogoAbierto.set(false);
    }
  }

  protected nombreInvalido(): boolean {
    const control = this.formulario.controls.nombre;
    return control.touched && control.invalid;
  }

  protected async guardar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.errorFormulario.set('Escribe un nombre de 2 a 140 caracteres.');
      return;
    }
    this.guardando.set(true);
    this.errorFormulario.set(null);
    const { nombre, padreId } = this.formulario.getRawValue();
    try {
      const actual = this.editando();
      const datos = { nombre: nombre.trim(), padreId, activo: actual?.activo ?? true };
      if (actual === null) {
        const creada = await this.servicio.crearArea(datos);
        this.areas.update((lista) => [...lista, creada].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.avisos.exito(`Área ${creada.nombre} creada`);
      } else {
        await this.recargarTras(this.servicio.editarArea(actual.id, datos));
        this.avisos.exito('Cambios guardados');
      }
      this.dialogoAbierto.set(false);
    } catch (error: unknown) {
      this.errorFormulario.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async alternarActivo(area: Area): Promise<void> {
    try {
      await this.recargarTras(this.servicio.editarArea(area.id, { nombre: area.nombre, padreId: area.padreId, activo: !area.activo }));
      this.avisos.exito(`Área ${area.activo ? 'desactivada' : 'activada'}`);
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    }
  }

  private async recargarTras(operacion: Promise<Area>): Promise<void> {
    await operacion;
    this.areas.set(await this.servicio.areas());
  }
}
