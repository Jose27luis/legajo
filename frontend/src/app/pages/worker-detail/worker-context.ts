import { Injectable, computed, effect, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { mensajeDeError } from '../../core/errors';
import type { Documento } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { DocumentsService } from '../../services/documents.service';
import { WorkersService } from '../../services/workers.service';

const INTERVALO_CONSULTA_MS = 2000;

@Injectable()
export class WorkerContext {
  private readonly trabajadores = inject(WorkersService);
  private readonly documentos = inject(DocumentsService);
  private readonly sesion = inject(SessionService);

  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((parametros) => parametros.get('id') ?? '')), {
    initialValue: '',
  });

  readonly detalle = resource({
    params: () => (this.id() === '' ? undefined : this.id()),
    loader: ({ params }) => this.trabajadores.obtener(params),
  });

  readonly legajo = resource({
    params: () => (this.id() === '' || !this.sesion.tiene('documentos.ver') ? undefined : this.id()),
    loader: ({ params }) => this.documentos.legajo(params),
  });

  readonly errorLegajo = computed(() => {
    const error = this.legajo.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  constructor() {
    effect((alLimpiar) => {
      if (!this.legajo.hasValue()) {
        return;
      }
      const pendientes = this.legajo.value().documentos.some((documento) => documento.estado === 'PROCESANDO');
      if (!pendientes) {
        return;
      }
      const temporizador = setTimeout(() => this.legajo.reload(), INTERVALO_CONSULTA_MS);
      alLimpiar(() => clearTimeout(temporizador));
    });
  }

  actualizarDocumento(documento: Documento): void {
    this.legajo.update((actual) => {
      if (actual === undefined) {
        return actual;
      }
      const existe = actual.documentos.some((item) => item.id === documento.id);
      return {
        ...actual,
        documentos: existe
          ? actual.documentos.map((item) => (item.id === documento.id ? documento : item))
          : [documento, ...actual.documentos],
      };
    });
    this.legajo.reload();
  }
}
