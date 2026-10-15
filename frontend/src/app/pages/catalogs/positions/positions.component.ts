import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent } from '../../../components/dialog/dialog.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../../core/errors';
import type { Cargo } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { CatalogsService } from '../../../services/catalogs.service';

@Component({
  selector: 'app-positions',
  imports: [ReactiveFormsModule, DialogComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './positions.component.html',
  styleUrl: './positions.component.css',
})
export class PositionsComponent implements OnInit {
  private readonly servicio = inject(CatalogsService);
  private readonly avisos = inject(ToastService);

  protected readonly cargos = signal<Cargo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly dialogoAbierto = signal(false);
  protected readonly editando = signal<Cargo | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly nombre = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
  });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      this.cargos.set(await this.servicio.cargos());
    } catch (error: unknown) {
      this.errorCarga.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nuevo(): void {
    this.editando.set(null);
    this.errorFormulario.set(null);
    this.nombre.reset('');
    this.dialogoAbierto.set(true);
  }

  protected editar(cargo: Cargo): void {
    this.editando.set(cargo);
    this.errorFormulario.set(null);
    this.nombre.reset(cargo.nombre);
    this.dialogoAbierto.set(true);
  }

  protected cerrar(): void {
    if (!this.guardando()) {
      this.dialogoAbierto.set(false);
    }
  }

  protected async guardar(): Promise<void> {
    if (this.nombre.invalid) {
      this.nombre.markAsTouched();
      this.errorFormulario.set('Escribe un nombre de 2 a 120 caracteres.');
      return;
    }
    this.guardando.set(true);
    this.errorFormulario.set(null);
    try {
      const actual = this.editando();
      const nombre = this.nombre.value.trim();
      if (actual === null) {
        const creado = await this.servicio.crearCargo({ nombre, activo: true });
        this.cargos.update((lista) => [...lista, creado].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.avisos.exito(`Cargo ${creado.nombre} creado`);
      } else {
        this.reemplazar(await this.servicio.editarCargo(actual.id, { nombre, activo: actual.activo }));
        this.avisos.exito('Cambios guardados');
      }
      this.dialogoAbierto.set(false);
    } catch (error: unknown) {
      this.errorFormulario.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async alternarActivo(cargo: Cargo): Promise<void> {
    try {
      const editado = await this.servicio.editarCargo(cargo.id, { nombre: cargo.nombre, activo: !cargo.activo });
      this.reemplazar(editado);
      this.avisos.exito(`Cargo ${editado.activo ? 'activado' : 'desactivado'}`);
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    }
  }

  private reemplazar(editado: Cargo): void {
    this.cargos.update((lista) => lista.map((cargo) => (cargo.id === editado.id ? editado : cargo)));
  }
}
