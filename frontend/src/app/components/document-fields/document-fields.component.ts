import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NIVELES_ACCESO, TEXTO_NIVEL_ACCESO, hoy } from '../../core/labels';
import type { CampoSeccion, NivelAcceso, SeccionLegajo, TipoDocumento } from '../../core/models';
import { SessionService } from '../../core/session.service';
import type { FormularioDocumento } from './document-form';

@Component({
  selector: 'app-document-fields',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-fields.component.html',
  styleUrl: './document-fields.component.css',
})
export class DocumentFieldsComponent {
  private readonly sesion = inject(SessionService);

  readonly grupo = input.required<FormularioDocumento>();
  readonly seccion = input.required<SeccionLegajo>();
  readonly prefijo = input.required<string>();
  readonly compacto = input(false);

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

  protected tipoElegido(): TipoDocumento | null {
    const id = this.grupo().controls.tipoDocumentoId.value;
    return this.seccion().tipos.find((tipo) => tipo.id === id) ?? null;
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
    return control.touched && control.invalid;
  }

  protected tipoEntrada(campo: CampoSeccion): string {
    return campo.tipo === 'fecha' ? 'date' : campo.tipo === 'numero' ? 'number' : 'text';
  }
}
