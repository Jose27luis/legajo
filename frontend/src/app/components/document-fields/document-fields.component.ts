import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NIVELES_ACCESO, TEXTO_NIVEL_ACCESO, hoy } from '../../core/labels';
import type { CampoSeccion, NivelAcceso, SeccionLegajo, TipoDocumento } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { LinkOptionsService } from '../../services/link-options.service';
import { campoObligatorio, esCurriculum, sincronizarCampos, type FormularioDocumento } from './document-form';

interface Opcion {
  valor: string;
  texto: string;
}

@Component({
  selector: 'app-document-fields',
  imports: [ReactiveFormsModule, NgTemplateOutlet],
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
  readonly conVinculo = input(false);
  readonly incorporacionSugerida = input<string | null>(null);

  protected readonly hoy = hoy();
  protected readonly textoNivel = TEXTO_NIVEL_ACCESO;

  protected readonly niveles = computed<readonly NivelAcceso[]>(() =>
    NIVELES_ACCESO.filter(
      (nivel) =>
        nivel === 'NORMAL' ||
        (nivel === 'RESTRINGIDO' && this.sesion.tiene('documentos.restringidos')) ||
        (nivel === 'MUY_RESTRINGIDO' && this.sesion.tiene('documentos.muy_restringidos')),
    ),
  );

  private readonly catalogos = computed(() => {
    const opciones = this.opcionesVinculo.opciones();
    const aOpcion = (item: { id: number; nombre: string }): Opcion => ({ valor: String(item.id), texto: item.nombre });
    return {
      regimen: (opciones?.regimenes ?? []).map(aOpcion),
      area: (opciones?.areas ?? []).map(aOpcion),
      cargo: (opciones?.cargos ?? []).map(aOpcion),
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
        const control = grupo.controls.datos.controls['tipoIncorporacion'];
        const sugerida = this.incorporacionSugerida();
        if (control !== undefined && control.value === '' && sugerida !== null) {
          control.setValue(sugerida);
        }
      });
      alLimpiar(() => suscripcion.unsubscribe());
    });
  }

  protected tipoElegido(): TipoDocumento | null {
    const id = this.grupo().controls.tipoDocumentoId.value;
    return this.seccion().tipos.find((tipo) => tipo.id === id) ?? null;
  }

  protected camposDelTipo(): CampoSeccion[] {
    return this.tipoElegido()?.campos ?? [];
  }

  protected esCurriculum(): boolean {
    return esCurriculum(this.tipoElegido());
  }

  protected guia(): string | null {
    const tipo = this.tipoElegido();
    if (tipo === null || this.seccion().numero !== 2) {
      return null;
    }
    if (tipo.accion === 'VINCULO') {
      return 'Documento de vínculo laboral: completa el tipo de incorporación, el régimen, el inicio, el término y la dependencia según el PDF.';
    }
    if (this.esCurriculum()) {
      return 'Currículum vitae: registra los datos del CV. No se modifica el vínculo laboral.';
    }
    if (/declaraci[oó]n jurada/i.test(tipo.nombre)) {
      return 'Declaración jurada: registra sus datos documentales, sin modificar el vínculo laboral.';
    }
    return 'Documento de incorporación: completa únicamente los datos que figuren en el PDF.';
  }

  protected opciones(campo: CampoSeccion): Opcion[] {
    if (campo.tipo === 'regimen' || campo.tipo === 'area' || campo.tipo === 'cargo') {
      return this.catalogos()[campo.tipo];
    }
    return (campo.opciones ?? []).map((opcion) => ({ valor: opcion, texto: opcion }));
  }

  protected esSeleccion(campo: CampoSeccion): boolean {
    return campo.tipo === 'seleccion' || campo.tipo === 'regimen' || campo.tipo === 'area' || campo.tipo === 'cargo';
  }

  protected obligatorio(campo: CampoSeccion): boolean {
    return campoObligatorio(campo, this.tipoElegido(), this.conVinculo());
  }

  protected nivelBloqueado(nivel: NivelAcceso): boolean {
    return nivel === 'NORMAL' && this.tipoElegido()?.restringido === true;
  }

  protected id(nombre: string): string {
    return `${this.prefijo()}-${nombre}`;
  }

  protected tipoInvalido(): boolean {
    const control = this.grupo().controls.tipoDocumentoId;
    return control.touched && control.invalid;
  }

  protected numeroInvalido(): boolean {
    const control = this.grupo().controls.numero;
    return control.touched && this.tipoElegido()?.requiereNumero === true && control.value.trim() === '';
  }

  protected campoInvalido(campo: CampoSeccion): boolean {
    const control = this.grupo().controls.datos.controls[campo.clave];
    return control !== undefined && control.touched && (control.invalid || (this.obligatorio(campo) && control.value.trim() === ''));
  }

  protected tipoEntrada(campo: CampoSeccion): string {
    return campo.tipo === 'fecha' ? 'date' : campo.tipo === 'numero' ? 'number' : 'text';
  }
}
