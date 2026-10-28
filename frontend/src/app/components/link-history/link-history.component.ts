import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { paginar } from '../../core/pagination';
import {
  MOTIVOS_CESE,
  TEXTO_MOTIVO_FIN,
  TEXTO_MOVIMIENTO,
  esSalidaDocumentada,
  fechaCorta,
  fechaRenuncia,
  periodoDelMovimiento,
  renunciaDelPeriodo,
  textoDato,
} from '../../core/labels';
import type { Documento, MovimientoLaboral, TrabajadorDetalle, Vinculo } from '../../core/models';
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
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly periodo = signal<Vinculo | null>(null);

  private readonly movimientosPorPeriodo = computed(() => {
    const trabajador = this.trabajador();
    const grupos = new Map<string | null, MovimientoLaboral[]>();
    const ordenados = [...trabajador.movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (const movimiento of ordenados) {
      const periodo = periodoDelMovimiento(movimiento, trabajador.vinculos, this.documentos());
      grupos.set(periodo, [...(grupos.get(periodo) ?? []), movimiento]);
    }
    return grupos;
  });
  protected readonly sinPeriodo = computed(() => this.movimientosPorPeriodo().get(null) ?? []);

  protected movimientos(vinculo: Vinculo): MovimientoLaboral[] {
    return this.movimientosPorPeriodo().get(vinculo.id) ?? [];
  }

  protected lineasMovimiento(movimiento: MovimientoLaboral): { texto: string; clase: string }[] {
    const documento = this.documentos().find((item) => item.id === movimiento.documentoId) ?? null;
    const desde = `${TEXTO_MOVIMIENTO[movimiento.tipo]} desde el ${fechaCorta(movimiento.fecha)}`;
    if (documento === null) {
      return [
        { texto: TEXTO_MOVIMIENTO[movimiento.tipo], clase: 'titulo-movimiento' },
        { texto: desde, clase: '' },
        { texto: `${movimiento.areaOrigen.nombre} → ${movimiento.areaDestino.nombre}`, clase: '' },
      ];
    }
    const referencia = [
      documento.numero === null ? null : `N.º ${documento.numero}`,
      documento.fechaEmision === null ? null : `Emitido el ${fechaCorta(documento.fechaEmision)}`,
    ].filter((parte) => parte !== null);
    const fin = textoDato(documento, 'fechaFinRotacion') ?? textoDato(documento, 'fechaTermino');
    const cargo = textoDato(documento, 'cargoAsignado');
    const archivo = documento.versiones.find((version) => version.actual)?.nombreOriginal ?? documento.tipo.nombre;
    return [
      { texto: documento.tipo.nombre, clase: 'titulo-movimiento' },
      { texto: referencia.length === 0 ? 'Sin número ni fecha de emisión' : referencia.join(' · '), clase: 'meta-movimiento' },
      { texto: fin === null ? desde : `${desde} hasta el ${fechaCorta(fin)}`, clase: '' },
      { texto: `${movimiento.areaOrigen.nombre} → ${movimiento.areaDestino.nombre}`, clase: '' },
      ...(cargo === null ? [] : [{ texto: `Cargo o función: ${cargo}`, clase: '' }]),
      { texto: archivo, clase: 'archivo-movimiento' },
    ];
  }

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

  protected sinSustento(vinculo: Vinculo): boolean {
    const motivo = vinculo.motivoFin;
    if (motivo === null || motivo === 'FIN_CONTRATO' || !MOTIVOS_CESE.some((cese) => cese === motivo)) {
      return false;
    }
    const documentado = this.documentos().some(
      (documento) => documento.vinculoId === vinculo.id && documento.seccion === 11 && documento.estado !== 'ANULADO',
    );
    return !documentado && renunciaDelPeriodo(vinculo, this.documentos()) === null;
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
