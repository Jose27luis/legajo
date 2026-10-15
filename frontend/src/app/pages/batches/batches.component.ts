import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { mensajeDeError } from '../../core/errors';
import { fechaHora } from '../../core/format';
import { CLASE_ESTADO_LOTE, TEXTO_ESTADO_LOTE, numeroSeccion, tamanoLegible } from '../../core/labels';
import type { VistaPreviaArchivo } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { BatchesService, MAXIMO_ARCHIVOS } from '../../services/batches.service';
import { DocumentsService, TAMANO_MAXIMO_MB, mensajeDeSubida, type SubidaEnCurso } from '../../services/documents.service';

const EN_PARALELO = 3;

interface Elegido {
  archivo: File;
  previa: VistaPreviaArchivo | null;
  invalido: string | null;
}

interface Avance {
  nombre: string;
  porcentaje: number;
  estado: 'espera' | 'subiendo' | 'listo' | 'error';
  motivo: string | null;
}

@Component({
  selector: 'app-batches',
  imports: [RouterLink, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './batches.component.html',
  styleUrl: './batches.component.css',
})
export class BatchesComponent implements OnDestroy {
  private readonly servicio = inject(BatchesService);
  private readonly documentos = inject(DocumentsService);
  private readonly avisos = inject(ToastService);
  private readonly router = inject(Router);

  private readonly selectorArchivos = viewChild.required<ElementRef<HTMLInputElement>>('selectorArchivos');
  private readonly selectorCarpeta = viewChild.required<ElementRef<HTMLInputElement>>('selectorCarpeta');

  protected readonly textoEstadoLote = TEXTO_ESTADO_LOTE;
  protected readonly claseEstadoLote = CLASE_ESTADO_LOTE;
  protected readonly numeroSeccion = numeroSeccion;
  protected readonly tamanoLegible = tamanoLegible;
  protected readonly fechaHora = fechaHora;
  protected readonly maximoArchivos = MAXIMO_ARCHIVOS;
  protected readonly tamanoMaximo = TAMANO_MAXIMO_MB;

  protected readonly elegidos = signal<Elegido[]>([]);
  protected readonly analizando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly arrastrando = signal(false);
  protected readonly avances = signal<Avance[]>([]);
  protected readonly subiendo = signal(false);

  protected readonly lotes = resource({
    params: () => this.subiendo(),
    loader: () => this.servicio.listar(),
  });

  protected readonly reconocidos = computed(() =>
    this.elegidos().filter((item) => item.invalido === null && item.previa?.reconocido === true),
  );
  protected readonly porRevisar = computed(() =>
    this.elegidos().filter((item) => item.invalido === null && item.previa?.reconocido === false),
  );
  protected readonly rechazados = computed(() => this.elegidos().filter((item) => item.invalido !== null));
  protected readonly validos = computed(() => this.elegidos().filter((item) => item.invalido === null));

  protected readonly avanceTotal = computed(() => {
    const lista = this.avances();
    if (lista.length === 0) {
      return 0;
    }
    return Math.floor(lista.reduce((suma, avance) => suma + avance.porcentaje, 0) / lista.length);
  });
  protected readonly subidos = computed(() => this.avances().filter((avance) => avance.estado === 'listo').length);
  protected readonly fallidos = computed(() => this.avances().filter((avance) => avance.estado === 'error').length);

  private enCurso: SubidaEnCurso[] = [];
  private cancelado = false;

  ngOnDestroy(): void {
    this.cancelar();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected alSalir(evento: BeforeUnloadEvent): void {
    if (this.subiendo()) {
      evento.preventDefault();
    }
  }

  protected abrirArchivos(): void {
    this.selectorArchivos().nativeElement.click();
  }

  protected abrirCarpeta(): void {
    this.selectorCarpeta().nativeElement.click();
  }

  protected alElegir(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      const archivos = evento.target.files;
      if (archivos !== null) {
        void this.tomar([...archivos]);
      }
      evento.target.value = '';
    }
  }

  protected alArrastrar(evento: DragEvent, encima: boolean): void {
    evento.preventDefault();
    if (!this.subiendo()) {
      this.arrastrando.set(encima);
    }
  }

  protected alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);
    const archivos = evento.dataTransfer?.files;
    if (!this.subiendo() && archivos !== undefined && archivos.length > 0) {
      void this.tomar([...archivos]);
    }
  }

  protected limpiar(): void {
    if (!this.subiendo()) {
      this.elegidos.set([]);
      this.avances.set([]);
      this.error.set(null);
    }
  }

  protected quitar(nombre: string): void {
    if (!this.subiendo()) {
      this.elegidos.update((lista) => lista.filter((item) => item.archivo.name !== nombre));
    }
  }

  protected cancelar(): void {
    this.cancelado = true;
    for (const subida of this.enCurso) {
      subida.cancelar();
    }
    this.enCurso = [];
  }

  protected async iniciar(): Promise<void> {
    const validos = this.validos();
    if (validos.length === 0 || this.subiendo()) {
      return;
    }
    this.subiendo.set(true);
    this.cancelado = false;
    this.error.set(null);
    this.avances.set(validos.map((item) => ({ nombre: item.archivo.name, porcentaje: 0, estado: 'espera', motivo: null })));
    try {
      const lote = await this.servicio.crear(validos.map((item) => ({ nombre: item.archivo.name, tamano: item.archivo.size })));
      const porNombre = new Map(validos.map((item) => [item.archivo.name, item.archivo]));
      const pendientes = [...lote.items].sort((a, b) => a.orden - b.orden);
      let siguiente = 0;
      const trabajar = async (): Promise<void> => {
        while (siguiente < pendientes.length && !this.cancelado) {
          const item = pendientes[siguiente++];
          const archivo = porNombre.get(item.nombreArchivo);
          if (archivo === undefined) {
            continue;
          }
          await this.subirUno(lote.id, item.id, archivo);
        }
      };
      await Promise.all(Array.from({ length: Math.min(EN_PARALELO, pendientes.length) }, trabajar));
      this.elegidos.set([]);
      if (this.cancelado) {
        this.avisos.error('Carga cancelada. Los archivos que faltaron quedaron en el lote.');
      } else {
        this.avisos.exito(`Carga terminada: ${this.subidos()} de ${pendientes.length} archivos`);
      }
      await this.router.navigate(['/bulk-upload', lote.id]);
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.enCurso = [];
      this.subiendo.set(false);
    }
  }

  private async subirUno(loteId: string, itemId: string, archivo: File): Promise<void> {
    this.marcar(archivo.name, { estado: 'subiendo' });
    try {
      const subida = this.documentos.subir(archivo, (porcentaje) => this.marcar(archivo.name, { porcentaje }));
      this.enCurso.push(subida);
      const subidaId = await subida.terminada;
      this.enCurso = this.enCurso.filter((item) => item !== subida);
      await this.servicio.avisarSubido(loteId, itemId, subidaId);
      this.marcar(archivo.name, { estado: 'listo', porcentaje: 100 });
    } catch (error: unknown) {
      if (!this.cancelado) {
        this.marcar(archivo.name, { estado: 'error', motivo: mensajeDeSubida(error) });
      }
    }
  }

  private marcar(nombre: string, cambios: Partial<Avance>): void {
    this.avances.update((lista) => lista.map((avance) => (avance.nombre === nombre ? { ...avance, ...cambios } : avance)));
  }

  private async tomar(archivos: File[]): Promise<void> {
    const actuales = this.elegidos();
    const vistos = new Set(actuales.map((item) => item.archivo.name));
    const nuevos: Elegido[] = [];
    for (const archivo of archivos) {
      if (actuales.length + nuevos.length >= MAXIMO_ARCHIVOS) {
        this.error.set(`Un lote admite hasta ${MAXIMO_ARCHIVOS} archivos. Los demás quedaron fuera.`);
        break;
      }
      const invalido = this.revisar(archivo, vistos);
      vistos.add(archivo.name);
      nuevos.push({ archivo, previa: null, invalido });
    }
    if (nuevos.length === 0) {
      return;
    }
    this.elegidos.set([...actuales, ...nuevos]);
    const porAnalizar = nuevos.filter((item) => item.invalido === null).map((item) => item.archivo.name);
    if (porAnalizar.length === 0) {
      return;
    }
    this.analizando.set(true);
    try {
      const previas = await this.servicio.previsualizar(porAnalizar);
      const porNombre = new Map(previas.map((previa) => [previa.nombre, previa]));
      this.elegidos.update((lista) =>
        lista.map((item) =>
          item.previa === null && porNombre.has(item.archivo.name) ? { ...item, previa: porNombre.get(item.archivo.name) ?? null } : item,
        ),
      );
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.analizando.set(false);
    }
  }

  private revisar(archivo: File, vistos: Set<string>): string | null {
    if (vistos.has(archivo.name)) {
      return 'Ya elegiste un archivo con este nombre';
    }
    if (!archivo.name.toLowerCase().endsWith('.pdf') || (archivo.type !== '' && archivo.type !== 'application/pdf')) {
      return 'No es un archivo PDF';
    }
    if (archivo.size === 0) {
      return 'El archivo está vacío';
    }
    if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      return `Supera los ${TAMANO_MAXIMO_MB} MB`;
    }
    return null;
  }
}
