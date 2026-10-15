import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent } from '../../../components/dialog/dialog.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import type { Area } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { CatalogsService } from '../../../services/catalogs.service';

@Component({
  selector: 'app-areas',
  imports: [ReactiveFormsModule, DialogComponent, SkeletonComponent],
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
  protected readonly opcionesPadre = computed(() => {
    const actual = this.editando();
    return this.areas().filter((area) => area.activo && area.id !== actual?.id);
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
