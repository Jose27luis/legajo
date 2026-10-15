import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../core/errors';
import type { CifraIndicador } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ReportsService } from '../../services/reports.service';

interface Barra {
  nombre: string;
  cantidad: number;
  ancho: number;
}

function barras(cifras: CifraIndicador[]): Barra[] {
  const mayor = Math.max(1, ...cifras.map((cifra) => cifra.cantidad));
  return cifras.map((cifra) => ({ ...cifra, ancho: Math.round((cifra.cantidad / mayor) * 100) }));
}

@Component({
  selector: 'app-statistics',
  imports: [SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.css',
})
export class StatisticsComponent {
  private readonly reportes = inject(ReportsService);
  protected readonly sesion = inject(SessionService);

  protected readonly indicadores = resource({ loader: () => this.reportes.indicadores() });
  protected readonly error = computed(() => {
    const error = this.indicadores.error();
    return error === undefined ? null : mensajeDeError(error);
  });
  protected readonly porSeccion = computed(() => barras(this.indicadores.value()?.porSeccion ?? []));
  protected readonly porRegimen = computed(() => barras(this.indicadores.value()?.porRegimen ?? []));
  protected readonly enlace = this.reportes.enlaceIndicadores();
}
