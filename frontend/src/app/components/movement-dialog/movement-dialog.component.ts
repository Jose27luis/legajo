import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource } from '@angular/core';
import { Router } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import { TEXTO_MOVIMIENTO, fechaCorta, nombreCompleto } from '../../core/labels';
import { SessionService } from '../../core/session.service';
import { DocumentsService } from '../../services/documents.service';
import { WorkersService } from '../../services/workers.service';
import { DialogComponent } from '../dialog/dialog.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-movement-dialog',
  imports: [DialogComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movement-dialog.component.html',
  styleUrl: './movement-dialog.component.css',
})
export class MovementDialogComponent {
  private readonly trabajadores = inject(WorkersService);
  private readonly documentos = inject(DocumentsService);
  private readonly router = inject(Router);
  protected readonly sesion = inject(SessionService);

  readonly trabajadorId = input<string | null>(null);
  readonly cerrar = output();

  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly fechaCorta = fechaCorta;
  protected readonly nombreCompleto = nombreCompleto;

  protected readonly detalle = resource({
    params: () => this.trabajadorId() ?? undefined,
    loader: ({ params }) => this.trabajadores.obtener(params),
  });
  protected readonly legajo = resource({
    params: () => (this.sesion.tiene('documentos.ver') ? (this.trabajadorId() ?? undefined) : undefined),
    loader: ({ params }) => this.documentos.legajo(params),
  });
  protected readonly error = computed(() => {
    const error = this.detalle.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly movimiento = computed(() => {
    if (!this.detalle.hasValue()) {
      return null;
    }
    const trabajador = this.detalle.value();
    if (trabajador.movimientoActual === 'SIN_MOVIMIENTO') {
      return null;
    }
    return trabajador.movimientos.find((item) => item.tipo === trabajador.movimientoActual) ?? null;
  });

  protected readonly documento = computed(() => {
    const id = this.movimiento()?.documentoId ?? null;
    if (id === null || !this.legajo.hasValue()) {
      return null;
    }
    return this.legajo.value().documentos.find((documento) => documento.id === id) ?? null;
  });

  protected enlace(id: string): string {
    return this.documentos.enlaceArchivo(id, false);
  }

  protected irASeccion(): void {
    const id = this.trabajadorId();
    if (id !== null) {
      this.cerrar.emit();
      void this.router.navigate(['/workers', id, 'sections', 5]);
    }
  }
}
