import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeDeError } from '../../core/errors';
import { normalizarTexto } from '../../core/format';
import { hoy } from '../../core/labels';
import type { AsignacionMasiva, CandidatoJefatura, CargoJefatura, DesignacionMasiva } from '../../core/models';
import { CatalogsService } from '../../services/catalogs.service';
import { DocumentsService, mensajeDeSubida } from '../../services/documents.service';
import { HeadshipsService } from '../../services/headships.service';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { DialogComponent } from '../dialog/dialog.component';
import { PdfPickerComponent } from '../pdf-picker/pdf-picker.component';
import { SearchSelectComponent, type OpcionBuscable, type ValorOpcion } from '../search-select/search-select.component';

export interface SedeDesignable {
  id: number;
  nombre: string;
  detalle: string;
  microredId: number | null;
}

interface Eleccion {
  trabajadorId: string;
  desde: string;
  hasta: string;
  ajustar: boolean;
}

const JEFE_EESS: CargoJefatura = 'Jefe/a de Establecimiento de Salud';
const GERENTE_MICRORED: CargoJefatura = 'Gerente de Microred';
const OPCION_VACIA: OpcionBuscable = { valor: '', etiqueta: 'Seleccionar...' };

@Component({
  selector: 'app-bulk-designation-dialog',
  imports: [ReactiveFormsModule, DialogComponent, DatePickerComponent, PdfPickerComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-designation-dialog.component.html',
  styleUrl: './bulk-designation-dialog.component.css',
})
export class BulkDesignationDialogComponent {
  private readonly jefaturas = inject(HeadshipsService);
  private readonly documentos = inject(DocumentsService);
  private readonly catalogos = inject(CatalogsService);

  readonly abierto = input.required<boolean>();
  readonly gerencias = input.required<boolean>();
  readonly sedes = input.required<readonly SedeDesignable[]>();
  readonly microredes = input.required<readonly OpcionBuscable[]>();
  readonly cerrar = output();
  readonly registrado = output<number>();

  protected readonly hoy = hoy();
  protected readonly archivo = signal<File | null>(null);
  protected readonly progreso = signal<number | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly intentado = signal(false);
  protected readonly busqueda = signal('');
  protected readonly microredId = signal<number | null>(null);
  protected readonly soloElegidas = signal(false);
  protected readonly elecciones = signal<ReadonlyMap<number, Eleccion>>(new Map());
  protected readonly candidatos = signal<ReadonlyMap<number, readonly CandidatoJefatura[]>>(new Map());
  protected readonly cargandoSede = signal<number | null>(null);
  protected readonly problemas = signal<ReadonlyMap<number, readonly string[]>>(new Map());
  protected readonly revisada = signal(false);

  protected readonly formulario = new FormGroup({
    numero: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(60)] }),
    fechaEmision: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tipoAccion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    desde: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    hasta: new FormControl('', { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  private readonly secciones = resource({ loader: () => this.catalogos.secciones() });

  constructor() {
    this.formulario.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.alCambiar());
  }

  protected readonly opcionesAccion = computed<OpcionBuscable[]>(() => {
    const campo = (this.secciones.hasValue() ? this.secciones.value() : [])
      .flatMap((seccion) => seccion.tipos)
      .find((tipo) => tipo.codigo === '0704')
      ?.campos.find((item) => item.clave === 'tipoAccion');
    return [OPCION_VACIA, ...(campo?.opciones ?? []).map((opcion) => ({ valor: opcion, etiqueta: opcion }))];
  });

  protected readonly cargo = computed<CargoJefatura>(() => (this.gerencias() ? GERENTE_MICRORED : JEFE_EESS));
  protected readonly persona = computed(() => (this.gerencias() ? 'gerente' : 'jefe'));

  protected readonly visibles = computed(() => {
    const termino = normalizarTexto(this.busqueda().trim());
    const microred = this.microredId();
    const elegidas = this.elecciones();
    return this.sedes().filter(
      (sede) =>
        (termino === '' || normalizarTexto(`${sede.nombre} ${sede.detalle}`).includes(termino)) &&
        (microred === null || sede.microredId === microred) &&
        (!this.soloElegidas() || elegidas.has(sede.id)),
    );
  });

  protected readonly cantidad = computed(() => [...this.elecciones().values()].filter((eleccion) => eleccion.trabajadorId !== '').length);

  protected readonly faltaArchivo = computed(() => this.intentado() && this.archivo() === null);

  protected reiniciar(): void {
    this.formulario.reset();
    this.archivo.set(null);
    this.progreso.set(null);
    this.error.set(null);
    this.intentado.set(false);
    this.busqueda.set('');
    this.microredId.set(null);
    this.soloElegidas.set(false);
    this.elecciones.set(new Map());
    this.problemas.set(new Map());
    this.revisada.set(false);
  }

  protected alCerrar(): void {
    if (!this.ocupado()) {
      this.reiniciar();
      this.cerrar.emit();
    }
  }

  protected alCambiar(): void {
    this.revisada.set(false);
    this.error.set(null);
  }

  protected buscar(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.busqueda.set(evento.target.value);
    }
  }

  protected filtrarMicrored(valor: ValorOpcion): void {
    this.microredId.set(typeof valor === 'number' ? valor : null);
  }

  protected alternarSoloElegidas(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.soloElegidas.set(evento.target.checked);
    }
  }

  protected eleccion(sede: SedeDesignable): Eleccion | null {
    return this.elecciones().get(sede.id) ?? null;
  }

  protected opcionesDe(sede: SedeDesignable): readonly OpcionBuscable[] {
    return [
      OPCION_VACIA,
      ...(this.candidatos().get(sede.id) ?? []).map((candidato) => ({
        valor: candidato.trabajadorId,
        etiqueta: candidato.nombre,
        detalle: `${candidato.documentoIdentidad} · ${candidato.cargo}${this.gerencias() ? ` · ${candidato.eess}` : ''}`,
      })),
    ];
  }

  protected sinPersonal(sede: SedeDesignable): boolean {
    return this.candidatos().get(sede.id)?.length === 0;
  }

  protected async elegir(sede: SedeDesignable): Promise<void> {
    this.alCambiar();
    if (!this.candidatos().has(sede.id)) {
      this.cargandoSede.set(sede.id);
      try {
        const lista = await this.jefaturas.candidatos(sede.id);
        this.candidatos.update((actual) => new Map(actual).set(sede.id, lista));
      } catch (error: unknown) {
        this.error.set(mensajeDeError(error));
        return;
      } finally {
        this.cargandoSede.set(null);
      }
    }
    this.elecciones.update((actual) => new Map(actual).set(sede.id, { trabajadorId: '', desde: '', hasta: '', ajustar: false }));
  }

  protected asignar(sede: SedeDesignable, valor: ValorOpcion): void {
    this.actualizar(sede, { trabajadorId: typeof valor === 'string' ? valor : '' });
  }

  protected alternarAjuste(sede: SedeDesignable, evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.actualizar(sede, { ajustar: evento.target.checked, desde: '', hasta: '' });
    }
  }

  protected fechaPropia(sede: SedeDesignable, campo: 'desde' | 'hasta', valor: string): void {
    this.actualizar(sede, { [campo]: valor });
  }

  protected quitar(sede: SedeDesignable): void {
    this.alCambiar();
    this.elecciones.update((actual) => {
      const siguiente = new Map(actual);
      siguiente.delete(sede.id);
      return siguiente;
    });
    this.problemas.update((actual) => {
      const siguiente = new Map(actual);
      siguiente.delete(sede.id);
      return siguiente;
    });
  }

  protected problemasDe(sede: SedeDesignable): readonly string[] {
    return this.problemas().get(sede.id) ?? [];
  }

  protected async revisar(): Promise<void> {
    const datos = this.armar();
    if (datos === null) {
      return;
    }
    this.ocupado.set(true);
    this.error.set(null);
    try {
      const revision = await this.jefaturas.revisar(datos);
      const porSede = new Map<number, readonly string[]>();
      for (const fila of revision.filas) {
        const asignacion = datos.asignaciones[fila.indice];
        if (asignacion !== undefined && fila.problemas.length > 0) {
          porSede.set(asignacion.areaId, fila.problemas);
        }
      }
      this.problemas.set(porSede);
      this.revisada.set(revision.valida);
      if (!revision.valida) {
        this.error.set(`Hay ${porSede.size} ${porSede.size === 1 ? 'fila con problemas' : 'filas con problemas'}. Corrígelas y vuelve a revisar.`);
        this.soloElegidas.set(true);
      }
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async registrar(): Promise<void> {
    const datos = this.armar();
    const archivo = this.archivo();
    if (datos === null || archivo === null || !this.revisada()) {
      return;
    }
    this.ocupado.set(true);
    this.error.set(null);
    let subidaId: string;
    try {
      subidaId = await this.documentos.subir(archivo, (porcentaje) => this.progreso.set(porcentaje)).terminada;
    } catch (error: unknown) {
      this.error.set(mensajeDeSubida(error));
      this.ocupado.set(false);
      this.progreso.set(null);
      return;
    }
    try {
      const resultado = await this.jefaturas.registrar(datos, subidaId);
      this.ocupado.set(false);
      this.reiniciar();
      this.registrado.emit(resultado.documentos.length);
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
      this.revisada.set(false);
      this.ocupado.set(false);
      this.progreso.set(null);
    }
  }

  private actualizar(sede: SedeDesignable, cambios: Partial<Eleccion>): void {
    const actual = this.elecciones().get(sede.id);
    if (actual === undefined) {
      return;
    }
    this.alCambiar();
    this.elecciones.update((mapa) => new Map(mapa).set(sede.id, { ...actual, ...cambios }));
  }

  private armar(): DesignacionMasiva | null {
    this.intentado.set(true);
    if (this.formulario.invalid || this.archivo() === null) {
      this.formulario.markAllAsTouched();
      this.error.set('Completa el PDF y los datos de la resolución marcados con *.');
      return null;
    }
    const asignaciones: AsignacionMasiva[] = [...this.elecciones().entries()]
      .filter(([, eleccion]) => eleccion.trabajadorId !== '')
      .map(([areaId, eleccion]) => ({
        trabajadorId: eleccion.trabajadorId,
        areaId,
        desde: eleccion.ajustar && eleccion.desde !== '' ? eleccion.desde : null,
        hasta: eleccion.ajustar && eleccion.hasta !== '' ? eleccion.hasta : null,
      }));
    if (asignaciones.length === 0) {
      this.error.set(`Elige al menos un ${this.persona()}.`);
      return null;
    }
    const valores = this.formulario.getRawValue();
    return {
      cargo: this.cargo(),
      numero: valores.numero.trim(),
      fechaEmision: valores.fechaEmision,
      tipoAccion: valores.tipoAccion,
      desde: valores.desde,
      hasta: valores.hasta === '' ? null : valores.hasta,
      nivelAcceso: 'NORMAL',
      observaciones: valores.observaciones.trim() === '' ? null : valores.observaciones.trim(),
      asignaciones,
    };
  }
}
