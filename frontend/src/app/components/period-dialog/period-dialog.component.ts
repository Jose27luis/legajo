import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import {
  CLASE_ESTADO_DOCUMENTO,
  TEXTO_ESTADO_DOCUMENTO,
  TEXTO_MOTIVO_FIN,
  TEXTO_MOVIMIENTO,
  camposMovimientoPersonal,
  esMovimientoPersonal,
  esSalidaDocumentada,
  fechaCorta,
  fechaMovimientoPersonal,
  nombreCompleto,
  periodoDelMovimiento,
  periodoDelMovimientoPersonal,
  rangoMovimientoPersonal,
  renunciaDelPeriodo,
  textoDato,
} from '../../core/labels';
import type { Documento, MovimientoLaboral, TrabajadorDetalle, Vinculo } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { DocumentsService } from '../../services/documents.service';
import { DialogComponent } from '../dialog/dialog.component';
import { IconComponent } from '../icon/icon.component';

interface FechasDocumento {
  inicio: string | null;
  fin: string | null;
  etiquetaInicio: string;
  etiquetaFin: string;
}

interface Mes {
  nombre: string;
  anio: string;
}

type ClaseEntrada = 'sustento' | 'personal' | 'movimiento' | 'salida';

interface EntradaBase {
  clave: string;
  fecha: string | null;
  orden: number;
}

interface EntradaDocumento extends EntradaBase {
  clase: 'sustento' | 'personal' | 'salida';
  documento: Documento;
}

interface EntradaMovimiento extends EntradaBase {
  clase: 'movimiento';
  movimiento: MovimientoLaboral;
  documento: Documento | null;
}

type Entrada = EntradaDocumento | EntradaMovimiento;

const MESES = ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Oct.', 'Nov.', 'Dic.'];

const PRIORIDAD: Record<ClaseEntrada, number> = { sustento: 0, personal: 1, movimiento: 2, salida: 3 };

const GRUPO: Record<ClaseEntrada, string> = {
  sustento: 'Incorporación · Sección 02',
  personal: 'Movimientos del personal · Sección 05',
  movimiento: 'Desplazamiento · Sección 07',
  salida: 'Desvinculación · Sección 11',
};

function fechaSustento(documento: Documento): string | null {
  return textoDato(documento, 'inicio') ?? documento.fechaEmision;
}

function fechaSalida(documento: Documento): string | null {
  return textoDato(documento, 'fechaCese') ?? textoDato(documento, 'fechaPresentacion') ?? documento.fechaEmision;
}

function masRecientePrimero(a: Documento, b: Documento): number {
  return (b.fechaEmision ?? '').localeCompare(a.fechaEmision ?? '') || b.creadoEn.localeCompare(a.creadoEn);
}

function masAntiguoPrimero(a: Documento, b: Documento): number {
  return (fechaSustento(a) ?? '').localeCompare(fechaSustento(b) ?? '') || a.creadoEn.localeCompare(b.creadoEn);
}

function cronologico(a: Entrada, b: Entrada): number {
  if (a.fecha !== b.fecha) {
    if (a.fecha === null) {
      return 1;
    }
    if (b.fecha === null) {
      return -1;
    }
    return a.fecha.localeCompare(b.fecha);
  }
  return PRIORIDAD[a.clase] - PRIORIDAD[b.clase] || a.orden - b.orden;
}

function esAdenda(documento: Documento): boolean {
  return documento.tipo.campos.some((campo) => campo.tipo === 'contrato');
}

@Component({
  selector: 'app-period-dialog',
  imports: [DialogComponent, IconComponent],
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
  protected readonly grupo = GRUPO;
  protected readonly fechaCorta = fechaCorta;
  protected readonly nombreCompleto = nombreCompleto;

  protected readonly esSalida = computed(() => {
    const vinculo = this.vinculo();
    return vinculo !== null && esSalidaDocumentada(vinculo, this.documentos());
  });
  protected readonly numeroSeccion = computed(() => (this.esSalida() ? 11 : 2));
  private readonly vinculados = computed(() => {
    const vinculo = this.vinculo();
    if (vinculo === null) {
      return [];
    }
    const propios = this.documentos().filter((documento) => documento.vinculoId === vinculo.id && documento.seccion === 2);
    const principales = propios.filter((documento) => !esAdenda(documento)).sort(masAntiguoPrimero);
    const adendas = propios.filter(esAdenda).sort(masAntiguoPrimero);
    const ordenados = principales.flatMap((principal) => [
      principal,
      ...adendas.filter((adenda) => textoDato(adenda, 'contratoRelacionado') === principal.id),
    ]);
    return [...ordenados, ...adendas.filter((adenda) => !ordenados.includes(adenda))];
  });
  private readonly salidas = computed(() => {
    const vinculo = this.vinculo();
    if (vinculo === null) {
      return [];
    }
    const renuncia = renunciaDelPeriodo(vinculo, this.documentos());
    const propias = this.documentos().filter(
      (documento) => documento.vinculoId === vinculo.id && documento.seccion === 11 && documento.id !== renuncia?.id,
    );
    return (renuncia === null ? propias : [...propias, renuncia]).sort(masRecientePrimero);
  });
  private readonly desplazamientos = computed(() => {
    const vinculo = this.vinculo();
    const trabajador = this.trabajador();
    if (vinculo === null || trabajador === null) {
      return [];
    }
    return trabajador.movimientos.filter(
      (movimiento) => periodoDelMovimiento(movimiento, trabajador.vinculos, this.documentos()) === vinculo.id,
    );
  });
  private readonly personal = computed(() => {
    const vinculo = this.vinculo();
    const trabajador = this.trabajador();
    if (vinculo === null || trabajador === null) {
      return [];
    }
    return this.documentos().filter(
      (documento) => esMovimientoPersonal(documento) && periodoDelMovimientoPersonal(documento, trabajador.vinculos) === vinculo.id,
    );
  });
  protected readonly lineaDeTiempo = computed<Entrada[]>(() => {
    const documentos = this.documentos();
    return [
      ...this.vinculados().map((documento, orden): Entrada => ({
        clase: 'sustento',
        clave: documento.id,
        fecha: fechaSustento(documento),
        orden,
        documento,
      })),
      ...this.personal().map((documento, orden): Entrada => ({
        clase: 'personal',
        clave: documento.id,
        fecha: fechaMovimientoPersonal(documento),
        orden,
        documento,
      })),
      ...this.desplazamientos().map((movimiento, orden): Entrada => ({
        clase: 'movimiento',
        clave: movimiento.id,
        fecha: movimiento.fecha,
        orden,
        movimiento,
        documento: documentos.find((documento) => documento.id === movimiento.documentoId) ?? null,
      })),
      ...this.salidas().map((documento, orden): Entrada => ({
        clase: 'salida',
        clave: documento.id,
        fecha: fechaSalida(documento),
        orden,
        documento,
      })),
    ].sort(cronologico);
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

  protected mes(fecha: string | null): Mes | null {
    if (fecha === null) {
      return null;
    }
    return { nombre: MESES[Number(fecha.slice(5, 7)) - 1] ?? '', anio: fecha.slice(0, 4) };
  }

  protected fechas(entrada: Entrada): FechasDocumento | null {
    if (entrada.clase === 'personal') {
      return rangoMovimientoPersonal(entrada.documento);
    }
    if (entrada.clase !== 'sustento') {
      return null;
    }
    const inicio = textoDato(entrada.documento, 'inicio');
    const fin = textoDato(entrada.documento, 'fin');
    if (inicio === null && fin === null) {
      return null;
    }
    const sufijo = esAdenda(entrada.documento) ? 'de periodo' : 'de contrato';
    return { inicio, fin, etiquetaInicio: `Inicio ${sufijo}`, etiquetaFin: `Fin ${sufijo}` };
  }

  protected detallePersonal(documento: Documento): string[] {
    return camposMovimientoPersonal(documento);
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
