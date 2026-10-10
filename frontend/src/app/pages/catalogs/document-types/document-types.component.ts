import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent } from '../../../components/dialog/dialog.component';
import { mensajeDeError } from '../../../core/errors';
import type { Seccion, TipoDocumento } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { CatalogsService } from '../../../services/catalogs.service';

@Component({
  selector: 'app-document-types',
  imports: [ReactiveFormsModule, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-types.component.html',
  styleUrl: './document-types.component.css',
})
export class DocumentTypesComponent implements OnInit {
  private readonly servicio = inject(CatalogsService);
  private readonly avisos = inject(ToastService);

  protected readonly secciones = signal<Seccion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly numeroSeleccionado = signal(1);
  protected readonly seccion = computed(
    () => this.secciones().find((seccion) => seccion.numero === this.numeroSeleccionado()) ?? null,
  );

  protected readonly dialogoAbierto = signal(false);
  protected readonly editando = signal<TipoDocumento | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly formulario = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    }),
    restringido: new FormControl(false, { nonNullable: true }),
    requiereNumero: new FormControl(false, { nonNullable: true }),
    tieneVencimiento: new FormControl(false, { nonNullable: true }),
    orden: new FormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(999)] }),
  });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      this.secciones.set(await this.servicio.secciones());
    } catch (error: unknown) {
      this.errorCarga.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected activos(seccion: Seccion): number {
    return seccion.tipos.filter((tipo) => tipo.activo).length;
  }

  protected nuevo(): void {
    this.editando.set(null);
    this.errorFormulario.set(null);
    this.formulario.reset({ nombre: '', restringido: false, requiereNumero: false, tieneVencimiento: false, orden: 0 });
    this.dialogoAbierto.set(true);
  }

  protected editar(tipo: TipoDocumento): void {
    this.editando.set(tipo);
    this.errorFormulario.set(null);
    this.formulario.reset({
      nombre: tipo.nombre,
      restringido: tipo.restringido,
      requiereNumero: tipo.requiereNumero,
      tieneVencimiento: tipo.tieneVencimiento,
      orden: tipo.orden,
    });
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
    const seccion = this.seccion();
    if (this.formulario.invalid || seccion === null) {
      this.formulario.markAllAsTouched();
      this.errorFormulario.set('Escribe un nombre de 3 a 200 caracteres.');
      return;
    }
    this.guardando.set(true);
    this.errorFormulario.set(null);
    const { nombre, restringido, requiereNumero, tieneVencimiento, orden } = this.formulario.getRawValue();
    const datos = { nombre: nombre.trim(), restringido, requiereNumero, tieneVencimiento };
    try {
      const actual = this.editando();
      if (actual === null) {
        const creado = await this.servicio.crearTipo(seccion.id, datos);
        this.actualizarSeccion(seccion.id, (tipos) => [...tipos, creado]);
        this.avisos.exito(`Tipo ${creado.codigo} creado`);
      } else {
        const editado = await this.servicio.editarTipo(actual.id, { ...datos, activo: actual.activo, orden });
        this.reemplazar(editado);
        this.avisos.exito(`Tipo ${editado.codigo} actualizado`);
      }
      this.dialogoAbierto.set(false);
    } catch (error: unknown) {
      this.errorFormulario.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async alternarActivo(tipo: TipoDocumento): Promise<void> {
    try {
      const editado = await this.servicio.editarTipo(tipo.id, {
        nombre: tipo.nombre,
        restringido: tipo.restringido,
        requiereNumero: tipo.requiereNumero,
        tieneVencimiento: tipo.tieneVencimiento,
        activo: !tipo.activo,
        orden: tipo.orden,
      });
      this.reemplazar(editado);
      this.avisos.exito(`Tipo ${editado.codigo} ${editado.activo ? 'activado' : 'desactivado'}`);
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    }
  }

  private reemplazar(editado: TipoDocumento): void {
    this.actualizarSeccion(editado.seccionId, (tipos) =>
      tipos.map((tipo) => (tipo.id === editado.id ? editado : tipo)).sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo)),
    );
  }

  private actualizarSeccion(seccionId: number, cambio: (tipos: TipoDocumento[]) => TipoDocumento[]): void {
    this.secciones.update((secciones) =>
      secciones.map((seccion) => (seccion.id === seccionId ? { ...seccion, tipos: cambio(seccion.tipos) } : seccion)),
    );
  }
}
