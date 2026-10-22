import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NIVELES_ACCESO, TEXTO_NIVEL_ACCESO, hoy } from '../../core/labels';
import type { CampoSeccion, FormularioTipo, NivelAcceso, SeccionLegajo, TipoDocumento } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { LinkOptionsService } from '../../services/link-options.service';
import { SearchSelectComponent, type OpcionBuscable } from '../search-select/search-select.component';
import { opcionesDependientes, sincronizarCampos, type FormularioDocumento } from './document-form';

const OPCION_VACIA: OpcionBuscable = { valor: '', etiqueta: 'Seleccionar...' };
const SOLO_VACIA: readonly OpcionBuscable[] = [OPCION_VACIA];
const FORMULARIO_BASE: FormularioTipo = { numero: 'Número de documento', fechaEmision: 'Fecha de emisión' };

@Component({
  selector: 'app-document-fields',
  imports: [ReactiveFormsModule, NgTemplateOutlet, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-fields.component.html',
  styleUrl: './document-fields.component.css',
})
export class DocumentFieldsComponent {
  private readonly sesion = inject(SessionService);
  private readonly opcionesVinculo = inject(LinkOptionsService);

  readonly grupo = input.required<FormularioDocumento>();
  readonly seccion = input.required<SeccionLegajo>();
  readonly prefijo = input.required<string>();
  readonly compacto = input(false);
  readonly nuevo = input(false);
  readonly contratos = input<readonly OpcionBuscable[]>([]);

  protected readonly hoy = hoy();

  protected readonly niveles = computed<readonly NivelAcceso[]>(() =>
    NIVELES_ACCESO.filter(
      (nivel) =>
        nivel === 'NORMAL' ||
        (nivel === 'RESTRINGIDO' && this.sesion.tiene('documentos.restringidos')) ||
        (nivel === 'MUY_RESTRINGIDO' && this.sesion.tiene('documentos.muy_restringidos')),
    ),
  );

  private readonly variantesNivel = computed(() => {
    const armar = (bloquearNormal: boolean): OpcionBuscable[] =>
      this.niveles().map((nivel) => ({
        valor: nivel,
        etiqueta: TEXTO_NIVEL_ACCESO[nivel],
        deshabilitada: bloquearNormal && nivel === 'NORMAL',
      }));
    return { libre: armar(false), restringido: armar(true) };
  });

  protected readonly opcionesTipo = computed<OpcionBuscable[]>(() =>
    this.seccion().tipos.map((tipo) => ({ valor: tipo.id, etiqueta: tipo.nombre })),
  );

  private readonly catalogos = computed(() => {
    const opciones = this.opcionesVinculo.opciones();
    const aOpcion = (item: { id: number; nombre: string }): OpcionBuscable => ({ valor: String(item.id), etiqueta: item.nombre });
    return {
      regimen: [OPCION_VACIA, ...(opciones?.regimenes ?? []).map(aOpcion)],
      area: [OPCION_VACIA, ...(opciones?.areas ?? []).map(aOpcion)],
      cargo: [OPCION_VACIA, ...(opciones?.cargos ?? []).map(aOpcion)],
      contrato: [OPCION_VACIA, ...this.contratos()],
    };
  });

  constructor() {
    void this.opcionesVinculo.cargar();
    effect((alLimpiar) => {
      const grupo = this.grupo();
      const seccion = this.seccion();
      const suscripcion = grupo.controls.tipoDocumentoId.valueChanges.subscribe((id) => {
        const tipo = seccion.tipos.find((item) => item.id === id) ?? null;
        sincronizarCampos(grupo, seccion, tipo, {});
      });
      alLimpiar(() => suscripcion.unsubscribe());
    });
  }

  protected tipoElegido(): TipoDocumento | null {
    const id = this.grupo().controls.tipoDocumentoId.value;
    return this.seccion().tipos.find((tipo) => tipo.id === id) ?? null;
  }

  protected formulario(): FormularioTipo {
    return this.tipoElegido()?.formulario ?? FORMULARIO_BASE;
  }

  protected opcionesEmisor(): readonly OpcionBuscable[] {
    return [OPCION_VACIA, ...(this.formulario().emisorOpciones ?? []).map((opcion) => ({ valor: opcion, etiqueta: opcion }))];
  }

  protected camposDelTipo(): CampoSeccion[] {
    return this.tipoElegido()?.campos ?? [];
  }

  protected guia(): string | null {
    const tipo = this.tipoElegido();
    if (tipo === null || tipo.accion !== 'VINCULO') {
      return null;
    }
    return 'Documento de vínculo laboral: el sistema decide si es primer ingreso, renovación o reingreso según el estado del trabajador y la fecha de inicio.';
  }

  protected opcionesDe(campo: CampoSeccion): readonly OpcionBuscable[] {
    if (campo.tipo === 'regimen' || campo.tipo === 'area' || campo.tipo === 'cargo' || campo.tipo === 'contrato') {
      return this.catalogos()[campo.tipo];
    }
    if (campo.tipo !== 'seleccion') {
      return SOLO_VACIA;
    }
    const padre = campo.dependeDe === undefined ? '' : (this.grupo().controls.datos.controls[campo.dependeDe.clave]?.value ?? '');
    return [OPCION_VACIA, ...opcionesDependientes(campo, padre).map((opcion) => ({ valor: opcion, etiqueta: opcion }))];
  }

  protected alCambiarDato(campo: CampoSeccion): void {
    for (const hijo of this.camposDelTipo().filter((item) => item.dependeDe?.clave === campo.clave)) {
      this.grupo().controls.datos.controls[hijo.clave]?.setValue('');
    }
  }

  protected opcionesNivel(): readonly OpcionBuscable[] {
    const variantes = this.variantesNivel();
    return this.tipoElegido()?.restringido === true ? variantes.restringido : variantes.libre;
  }

  protected esSeleccion(campo: CampoSeccion): boolean {
    return (
      campo.tipo === 'seleccion' || campo.tipo === 'regimen' || campo.tipo === 'area' || campo.tipo === 'cargo' || campo.tipo === 'contrato'
    );
  }

  protected id(nombre: string): string {
    return `${this.prefijo()}-${nombre}`;
  }

  protected tipoInvalido(): boolean {
    const control = this.grupo().controls.tipoDocumentoId;
    return control.touched && control.invalid;
  }

  protected campoInvalido(campo: CampoSeccion): boolean {
    const control = this.grupo().controls.datos.controls[campo.clave];
    return control !== undefined && control.touched && (control.invalid || (campo.obligatorio && control.value.trim() === ''));
  }

  protected tipoEntrada(campo: CampoSeccion): string {
    return campo.tipo === 'fecha' ? 'date' : campo.tipo === 'numero' ? 'number' : 'text';
  }
}
