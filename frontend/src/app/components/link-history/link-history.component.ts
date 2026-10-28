import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { paginar } from '../../core/pagination';
import { TEXTO_MOTIVO_FIN, esSalidaDocumentada, fechaCorta, fechaRenuncia, renunciaDelPeriodo } from '../../core/labels';
import type { Documento, TrabajadorDetalle, Vinculo } from '../../core/models';
import { PagerComponent } from '../pager/pager.component';
import { PeriodDialogComponent } from '../period-dialog/period-dialog.component';

const VINCULOS_POR_PAGINA = 5;

@Component({
  selector: 'app-link-history',
  imports: [PagerComponent, PeriodDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-history.component.html',
  styleUrl: './link-history.component.css',
})
export class LinkHistoryComponent {
  readonly trabajador = input.required<TrabajadorDetalle>();
  readonly documentos = input<Documento[]>([]);
  readonly registrado = output<Documento>();

  protected readonly fechaCorta = fechaCorta;
  protected readonly periodo = signal<Vinculo | null>(null);

  protected readonly vinculos = paginar(
    () => this.trabajador().vinculos,
    VINCULOS_POR_PAGINA,
    () => this.trabajador().id,
  );

  protected esCese(vinculo: Vinculo): boolean {
    return esSalidaDocumentada(vinculo, this.documentos());
  }

  protected estado(vinculo: Vinculo): string {
    if (vinculo.fechaFin === null) {
      return 'ACTIVO';
    }
    return this.esCese(vinculo) ? 'CESADO' : 'CONCLUIDO';
  }

  protected motivoTermino(vinculo: Vinculo, renuncia: string | null): string | null {
    if (renuncia !== null) {
      return vinculo.fechaFin === null ? 'Renuncia voluntaria presentada' : 'Terminó por renuncia voluntaria';
    }
    return vinculo.motivoFin === null ? null : `Terminó por ${TEXTO_MOTIVO_FIN[vinculo.motivoFin].toLowerCase()}`;
  }

  protected esConcluido(vinculo: Vinculo): boolean {
    return vinculo.fechaFin !== null && !this.esCese(vinculo);
  }

  protected renuncia(vinculo: Vinculo): string | null {
    const documento = renunciaDelPeriodo(vinculo, this.documentos());
    if (documento === null && vinculo.motivoFin !== 'RENUNCIA') {
      return null;
    }
    const fecha = documento === null ? vinculo.fechaFin : fechaRenuncia(documento, vinculo);
    return fecha === null ? 'RENUNCIA' : `RENUNCIA · ${fechaCorta(fecha)}`;
  }

  protected pistaPeriodo(vinculo: Vinculo): string {
    if (this.esCese(vinculo)) {
      return 'Ver sustento del cese · Sección 11';
    }
    if (renunciaDelPeriodo(vinculo, this.documentos()) !== null) {
      return 'Ver sustento y carta de renuncia';
    }
    const vinculados = this.documentos().some((documento) => documento.vinculoId === vinculo.id && documento.seccion === 2);
    return vinculados ? 'Ver documento sustentatorio · Sección 02' : 'Sin documento sustentatorio · Sección 02';
  }
}
