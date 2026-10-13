import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type NombreIcono =
  | 'inicio'
  | 'personal'
  | 'perfil'
  | 'usuarios'
  | 'catalogos'
  | 'carga'
  | 'buscar'
  | 'reportes'
  | 'auditoria'
  | 'historial'
  | 'salir'
  | 'menu'
  | 'contraer'
  | 'abajo'
  | 'cerrar';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.css',
})
export class IconComponent {
  readonly nombre = input.required<NombreIcono>();
  readonly tamano = input(20);
}
