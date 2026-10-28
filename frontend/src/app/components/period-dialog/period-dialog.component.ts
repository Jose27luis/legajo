import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import {
  CLASE_ESTADO_DOCUMENTO,
  TEXTO_ESTADO_DOCUMENTO,
  TEXTO_MOTIVO_FIN,
  TEXTO_MOVIMIENTO,
  esSalidaDocumentada,
  fechaCorta,
  nombreCompleto,
  periodoDelMovimiento,
  renunciaDelPeriodo,
  textoDato,
} from '../../core/labels';
import type { Documento, TrabajadorDetalle, Vinculo } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { DocumentsService } from '../../services/documents.service';
import { DialogComponent } from '../dialog/dialog.component';

@Component({
  selector: 'app-period-dialog',
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './period-dialog.component.html',
  styleUrl: './period-dialog.component.css',
})
export class PeriodDialogComponent {
  private readonly servicio = inject(DocumentsService);
  private readonly avisos = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly sesion = inject(SessionService);

  readonly vinculo = input<Vinculo | null>(null);
  readonly trabajador = input<TrabajadorDetalle | null>(null);
  readonly documentos = input<Documento[]>([]);
  readonly cerrar = output();
  readonly registrado = output<Documento>();

  protected readonly textoEstado = TEXTO_ESTADO_DOCUMENTO;
  protected readonly claseEstado = CLASE_ESTADO_DOCUMENTO;
  protected readonly textoMotivoFin = TEXTO_MOTIVO_FIN;
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly fechaCorta = fechaCorta;
  protected readonly nombreCompleto = nombreCompleto;

  protected readonly esSalida = computed(() => {
    const vinculo = this.vinculo();
    return vinculo !== null && esSalidaDocumentada(vinculo, this.documentos());
  });
  protected readonly numeroSeccion = computed(() => (this.esSalida() ? 11 : 2));
  protected readonly vinculados = computed(() => {
    const vinculo = this.vinculo();
    return vinculo === null ? [] : this.documentos().filter((documento) => documento.vinculoId === vinculo.id && documento.seccion === 2);
  });
  protected readonly salidas = computed(() => {
    const vinculo = this.vinculo();
    if (vinculo === null) {
      return [];
    }
    const renuncia = renunciaDelPeriodo(vinculo, this.documentos());
    const propias = this.documentos().filter(
      (documento) => documento.vinculoId === vinculo.id && documento.seccion === 11 && documento.id !== renuncia?.id,
    );
    return renuncia === null ? propias : [...propias, renuncia];
  });
  protected readonly desplazamientos = computed(() => {
    const vinculo = this.vinculo();
    const trabajador = this.trabajador();
    if (vinculo === null || trabajador === null) {
      return [];
    }
    return [...trabajador.movimientos]
      .filter((movimiento) => periodoDelMovimiento(movimiento, trabajador.vinculos, this.documentos()) === vinculo.id)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((movimiento) => ({
        movimiento,
        documento: this.documentos().find((documento) => documento.id === movimiento.documentoId) ?? null,
      }));
  });
  protected readonly sinEnlazar = computed(() =>
    this.esSalida()
      ? []
      : this.documentos().filter(
          (documento) =>
            documento.seccion === 2 &&
            documento.tipo.accion === 'VINCULO' &&
            documento.vinculoId === null &&
            documento.estado !== 'ANULADO',
        ),
  );
  protected readonly puedeEnlazar = computed(() => this.sesion.tiene('personal.editar'));
  protected readonly enlazando = signal<string | null>(null);
  protected readonly error = linkedSignal<string | undefined, string | null>({
    source: () => this.vinculo()?.id,
    computation: () => null,
  });

  protected enlace(documento: Documento): string {
    return this.servicio.enlaceArchivo(documento.id, false);
  }

  protected referencia(documento: Documento): string {
    const partes = [
      documento.numero === null ? null : `N.º ${documento.numero}`,
      documento.fechaEmision === null ? null : `Emitido el ${fechaCorta(documento.fechaEmision)}`,
    ].filter((parte) => parte !== null);
    return partes.length === 0 ? 'Sin número ni fecha de emisión' : partes.join(' · ');
  }

  protected detalleSalida(documento: Documento): string[] {
    const presentacion = textoDato(documento, 'fechaPresentacion');
    const cese = textoDato(documento, 'fechaCese');
    return [
      textoDato(documento, 'motivoRenuncia') ?? textoDato(documento, 'motivoCese'),
      presentacion === null ? null : `Presentada el ${fechaCorta(presentacion)}`,
      cese === null ? null : `Cese el ${fechaCorta(cese)}`,
    ].filter((parte) => parte !== null);
  }

  protected nombreArchivo(documento: Documento): string {
    return documento.versiones.find((version) => version.actual)?.nombreOriginal ?? documento.tipo.nombre;
  }

  protected irASeccion(): void {
    const trabajador = this.trabajador();
    if (trabajador !== null) {
      this.cerrar.emit();
      void this.router.navigate(['/workers', trabajador.id, 'sections', this.numeroSeccion()]);
    }
  }

  protected alCerrar(): void {
    if (this.enlazando() === null) {
      this.cerrar.emit();
    }
  }

  protected async enlazar(documento: Documento): Promise<void> {
    const vinculo = this.vinculo();
    if (vinculo === null || this.enlazando() !== null) {
      return;
    }
    this.enlazando.set(documento.id);
    this.error.set(null);
    try {
      const actualizado = await this.servicio.enlazarPeriodo(documento.id, vinculo.id);
      this.registrado.emit(actualizado);
      this.avisos.exito('Contrato enlazado al período laboral.');
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.enlazando.set(null);
    }
  }
}
