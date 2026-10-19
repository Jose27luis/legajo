import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UbigeoService } from '../../services/ubigeo.service';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../search-select/search-select.component';
import type { CamposUbigeo } from './ubigeo-form';

const SIN_REGISTRAR: OpcionBuscable = { valor: '', etiqueta: 'No registrado' };

@Component({
  selector: 'app-ubigeo-fields',
  imports: [ReactiveFormsModule, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ubigeo-fields.component.html',
  styleUrl: './ubigeo-fields.component.css',
})
export class UbigeoFieldsComponent {
  private readonly ubigeo = inject(UbigeoService);

  readonly grupo = input.required<FormGroup<CamposUbigeo>>();
  readonly prefijo = input.required<string>();

  protected readonly departamento = signal('');
  protected readonly provincia = signal('');

  private readonly lugarElegido = computed(() => this.ubigeo.departamentos().find((item) => item.nombre === this.departamento()) ?? null);

  protected readonly opcionesDepartamento = computed<OpcionBuscable[]>(() => [
    SIN_REGISTRAR,
    ...this.ubigeo.departamentos().map((item) => ({ valor: item.nombre, etiqueta: item.nombre })),
  ]);
  protected readonly opcionesProvincia = computed<OpcionBuscable[]>(() => [
    SIN_REGISTRAR,
    ...(this.lugarElegido()?.provincias ?? []).map((item) => ({ valor: item.nombre, etiqueta: item.nombre })),
  ]);
  protected readonly opcionesDistrito = computed<OpcionBuscable[]>(() => [
    SIN_REGISTRAR,
    ...(this.lugarElegido()?.provincias.find((item) => item.nombre === this.provincia())?.distritos ?? []).map((nombre) => ({
      valor: nombre,
      etiqueta: nombre,
    })),
  ]);

  constructor() {
    void this.ubigeo.cargar();
    effect((alLimpiar) => {
      const grupo = this.grupo();
      const leer = (): void => {
        const valores = grupo.getRawValue();
        this.departamento.set(valores.departamento);
        this.provincia.set(valores.provincia);
      };
      leer();
      const suscripcion = grupo.valueChanges.subscribe(leer);
      alLimpiar(() => suscripcion.unsubscribe());
    });
  }

  protected id(nombre: string): string {
    return `${this.prefijo()}-${nombre}`;
  }

  protected elegirDepartamento(valor: ValorOpcion): void {
    if (typeof valor === 'string') {
      this.grupo().patchValue({ provincia: '', distrito: '' });
    }
  }

  protected elegirProvincia(valor: ValorOpcion): void {
    if (typeof valor === 'string') {
      this.grupo().patchValue({ distrito: '' });
    }
  }
}
