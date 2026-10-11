import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CLASE_SITUACION, TEXTO_SITUACION, fechaCorta, numeroSeccion } from '../../core/labels';
import type { FaltantesTrabajador } from '../../core/models';

@Component({
  selector: 'app-requirements-table',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requirements-table.component.html',
  styleUrl: './requirements-table.component.css',
})
export class RequirementsTableComponent {
  readonly datos = input.required<FaltantesTrabajador>();

  protected readonly textoSituacion = TEXTO_SITUACION;
  protected readonly claseSituacion = CLASE_SITUACION;
  protected readonly numeroSeccion = numeroSeccion;
  protected readonly fechaCorta = fechaCorta;
}
