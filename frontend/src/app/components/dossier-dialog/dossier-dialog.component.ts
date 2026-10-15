import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, resource, signal } from '@angular/core';
import { mensajeDeError } from '../../core/errors';
import { numeroSeccion } from '../../core/labels';
import { SessionService } from '../../core/session.service';
import { DocumentsService } from '../../services/documents.service';
import { DialogComponent } from '../dialog/dialog.component';

export interface TrabajadorExpediente {
  id: string;
  nombre: string;
  tipoDocIdentidad: string;
  numeroDoc: string;
  regimen: string | null;
  estado: string;
}

interface FilaSeccion {
  numero: number;
  nombre: string;
  registros: number;
  pdf: number;
  restringida: boolean;
}

@Component({
  selector: 'app-dossier-dialog',
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dossier-dialog.component.html',
  styleUrl: './dossier-dialog.component.css',
})
export class DossierDialogComponent {
  private readonly documentos = inject(DocumentsService);
  protected readonly sesion = inject(SessionService);

  readonly trabajador = input<TrabajadorExpediente | null>(null);
  readonly cerrar = output();

  protected readonly numeroSeccion = numeroSeccion;
  protected readonly portada = signal(true);

  protected readonly legajo = resource({
    params: () => this.trabajador()?.id,
    loader: ({ params }) => this.documentos.legajo(params),
  });
  protected readonly error = computed(() => {
    const error = this.legajo.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly filas = computed<FilaSeccion[]>(() => {
    if (!this.legajo.hasValue()) {
      return [];
    }
    const { secciones, documentos } = this.legajo.value();
    return secciones.map((seccion) => {
      const propios = documentos.filter((documento) => documento.seccion === seccion.numero && documento.estado !== 'ANULADO');
      return {
        numero: seccion.numero,
        nombre: seccion.nombre,
        registros: propios.length,
        pdf: propios.filter((documento) => documento.estado === 'DISPONIBLE').length,
        restringida: seccion.restringida,
      };
    });
  });

  protected readonly elegidas = linkedSignal<FilaSeccion[], number[]>({
    source: this.filas,
    computation: (filas) => filas.filter((fila) => !fila.restringida).map((fila) => fila.numero),
  });

  protected readonly totales = computed(() => {
    const filas = this.filas();
    return {
      registros: filas.reduce((suma, fila) => suma + fila.registros, 0),
      pdf: filas.reduce((suma, fila) => suma + fila.pdf, 0),
      elegidos: filas.filter((fila) => this.elegidas().includes(fila.numero)).reduce((suma, fila) => suma + fila.pdf, 0),
    };
  });

  protected readonly enlacePdf = computed(() =>
    this.enlace((id, secciones) => this.documentos.enlaceExpediente(id, secciones, this.portada())),
  );
  protected readonly enlaceZip = computed(() => this.enlace((id, secciones) => this.documentos.enlaceZip(id, secciones)));
  protected readonly enlaceIndice = computed(() => this.enlace((id, secciones) => this.documentos.enlaceIndice(id, secciones)));

  protected alternar(numero: number): void {
    this.elegidas.update((actuales) => (actuales.includes(numero) ? actuales.filter((item) => item !== numero) : [...actuales, numero]));
  }

  private enlace(armar: (id: string, secciones: number[]) => string): string | null {
    const trabajador = this.trabajador();
    const secciones = [...this.elegidas()].sort((a, b) => a - b);
    return trabajador === null || secciones.length === 0 ? null : armar(trabajador.id, secciones);
  }
}
