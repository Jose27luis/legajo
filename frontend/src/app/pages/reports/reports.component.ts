import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface Pestana {
  ruta: string;
  etiqueta: string;
}

@Component({
  selector: 'app-reports',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
})
export class ReportsComponent {
  protected readonly pestanas: readonly Pestana[] = [
    { ruta: 'staff', etiqueta: 'Listado de personal' },
    { ruta: 'missing-summary', etiqueta: 'Faltantes consolidado' },
    { ruta: 'missing', etiqueta: 'Faltantes por trabajador' },
    { ruta: 'expiring', etiqueta: 'Por vencer y vencidos' },
    { ruta: 'digitization', etiqueta: 'Digitalización' },
    { ruta: 'progress', etiqueta: 'Avance de legajos' },
  ];
}
