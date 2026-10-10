import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent } from '../../../components/dialog/dialog.component';
import { mensajeDeError } from '../../../core/errors';
import type { Regimen } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { CatalogsService } from '../../../services/catalogs.service';

@Component({
  selector: 'app-regimes',
  imports: [ReactiveFormsModule, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './regimes.component.html',
  styleUrl: './regimes.component.css',
})
export class RegimesComponent implements OnInit {
  private readonly servicio = inject(CatalogsService);
  private readonly avisos = inject(ToastService);

  protected readonly regimenes = signal<Regimen[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly dialogoAbierto = signal(false);
  protected readonly editando = signal<Regimen | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly formulario = new FormGroup({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9_]{2,20}$/)] }),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)] }),
    esLaboral: new FormControl(true, { nonNullable: true }),
  });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      this.regimenes.set(await this.servicio.regimenes());
    } catch (error: unknown) {
      this.errorCarga.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nuevo(): void {
    this.editando.set(null);
    this.errorFormulario.set(null);
    this.formulario.reset({ codigo: '', nombre: '', esLaboral: true });
    this.formulario.controls.codigo.enable();
    this.dialogoAbierto.set(true);
  }

  protected editar(regimen: Regimen): void {
    this.editando.set(regimen);
    this.errorFormulario.set(null);
    this.formulario.reset({ codigo: regimen.codigo, nombre: regimen.nombre, esLaboral: regimen.esLaboral });
    this.formulario.controls.codigo.disable();
    this.dialogoAbierto.set(true);
  }

  protected cerrar(): void {
    if (!this.guardando()) {
      this.dialogoAbierto.set(false);
    }
  }

  protected invalido(campo: 'codigo' | 'nombre'): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  protected async guardar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.errorFormulario.set('Revisa los campos marcados.');
      return;
    }
    this.guardando.set(true);
    this.errorFormulario.set(null);
    const { codigo, nombre, esLaboral } = this.formulario.getRawValue();
    try {
      const actual = this.editando();
      if (actual === null) {
        const creado = await this.servicio.crearRegimen({ codigo: codigo.toUpperCase(), nombre: nombre.trim(), esLaboral, activo: true });
        this.regimenes.update((lista) => [...lista, creado].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.avisos.exito(`Régimen ${creado.nombre} creado`);
      } else {
        this.reemplazar(await this.servicio.editarRegimen(actual.id, { nombre: nombre.trim(), esLaboral, activo: actual.activo }));
        this.avisos.exito('Cambios guardados');
      }
      this.dialogoAbierto.set(false);
    } catch (error: unknown) {
      this.errorFormulario.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async alternarActivo(regimen: Regimen): Promise<void> {
    try {
      const editado = await this.servicio.editarRegimen(regimen.id, {
        nombre: regimen.nombre,
        esLaboral: regimen.esLaboral,
        activo: !regimen.activo,
      });
      this.reemplazar(editado);
      this.avisos.exito(`Régimen ${editado.activo ? 'activado' : 'desactivado'}`);
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    }
  }

  private reemplazar(editado: Regimen): void {
    this.regimenes.update((lista) => lista.map((regimen) => (regimen.id === editado.id ? editado : regimen)));
  }
}
