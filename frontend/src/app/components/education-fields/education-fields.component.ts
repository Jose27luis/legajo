import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EducationService } from '../../services/education.service';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../search-select/search-select.component';
import type { CamposFormacion } from './education-form';

const SIN_REGISTRAR: OpcionBuscable = { valor: '', etiqueta: 'No registrado' };

@Component({
  selector: 'app-education-fields',
  imports: [ReactiveFormsModule, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './education-fields.component.html',
  styleUrl: './education-fields.component.css',
})
export class EducationFieldsComponent {
  private readonly formacion = inject(EducationService);

  readonly grupo = input.required<FormGroup<CamposFormacion>>();
  readonly prefijo = input.required<string>();

  protected readonly grado = signal('');
  private readonly profesionActual = signal('');

  private readonly gradoElegido = computed(() => this.formacion.grados().find((item) => item.nombre === this.grado()) ?? null);

  protected readonly opcionesGrado = computed<OpcionBuscable[]>(() => [
    SIN_REGISTRAR,
    ...this.formacion.grados().map((item) => ({ valor: item.nombre, etiqueta: item.nombre })),
  ]);
  protected readonly opcionesProfesion = computed<OpcionBuscable[]>(() => {
    const lista = this.gradoElegido()?.profesiones ?? [];
    const actual = this.profesionActual();
    const todas = actual !== '' && !lista.includes(actual) ? [actual, ...lista] : lista;
    return [SIN_REGISTRAR, ...todas.map((nombre) => ({ valor: nombre, etiqueta: nombre }))];
  });
  protected readonly opcionesCondicion = computed<OpcionBuscable[]>(() => [
    SIN_REGISTRAR,
    ...(this.gradoElegido()?.condiciones ?? []).map((nombre) => ({ valor: nombre, etiqueta: nombre })),
  ]);

  constructor() {
    void this.formacion.cargar();
    effect((alLimpiar) => {
      const grupo = this.grupo();
      const leer = (): void => {
        const valores = grupo.getRawValue();
        this.grado.set(valores.gradoInstruccion);
        this.profesionActual.set(valores.profesion);
      };
      leer();
      const suscripcion = grupo.valueChanges.subscribe(leer);
      alLimpiar(() => suscripcion.unsubscribe());
    });
  }

  protected id(nombre: string): string {
    return `${this.prefijo()}-${nombre}`;
  }

  protected elegirGrado(valor: ValorOpcion): void {
    if (typeof valor === 'string') {
      this.grupo().patchValue({ profesion: '', condicionProfesion: '' });
    }
  }
}
