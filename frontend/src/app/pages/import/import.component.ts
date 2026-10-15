import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';
import { mensajeDeError } from '../../core/errors';
import { normalizarTexto } from '../../core/format';
import { TEXTO_MOTIVO_CESE, TEXTO_TIPO_PERSONAL, fechaCorta, tamanoLegible } from '../../core/labels';
import type { FilaImportacion, ResultadoImportacion, VistaImportacion } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ImportService } from '../../services/import.service';

const TAMANO_MAXIMO = 5 * 1024 * 1024;
const EXTENSIONES = /\.(csv|xlsx|xls)$/i;
const POR_PAGINA = 50;
const MAXIMO_BARRAS = 6;

const PLANTILLA = [
  'dni;apellido_paterno;apellido_materno;nombres;tipo_personal;regimen;area;cargo;estado;fecha_ingreso;fecha_cese;motivo_cese',
  '00000000;APELLIDO;APELLIDO;NOMBRES;ADMINISTRATIVO;D.L. 276;Oficina de Personal;Técnico administrativo;ACTIVO;01/03/2020;;',
].join('\r\n');

type Fase = 'elegir' | 'analizando' | 'revisar' | 'terminado';

interface Barra {
  nombre: string;
  cantidad: number;
  porcentaje: number;
}

interface Distribucion {
  titulo: string;
  barras: Barra[];
  resto: number;
}

interface GrupoObservacion {
  motivo: string;
  filas: string[];
}

function distribucion(titulo: string, valores: string[], maximo = MAXIMO_BARRAS, cronologico = false): Distribucion {
  const conteo = new Map<string, number>();
  for (const valor of valores) {
    conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
  }
  const ordenadas = [...conteo.entries()].sort((a, b) => (cronologico ? a[0].localeCompare(b[0]) : b[1] - a[1]));
  const total = Math.max(1, valores.length);
  return {
    titulo,
    barras: ordenadas
      .slice(0, maximo)
      .map(([nombre, cantidad]) => ({ nombre, cantidad, porcentaje: Math.round((cantidad / total) * 1000) / 10 })),
    resto: ordenadas.slice(maximo).reduce((suma, [, cantidad]) => suma + cantidad, 0),
  };
}

function formatoDe(nombre: string): string {
  const extension = nombre.toLowerCase().split('.').pop() ?? '';
  if (extension === 'xls') {
    return 'Padrón nominal INFORHUS';
  }
  return extension === 'xlsx' ? 'Libro de Excel' : 'Archivo CSV';
}

@Component({
  selector: 'app-import',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import.component.html',
  styleUrl: './import.component.css',
})
export class ImportComponent {
  private readonly servicio = inject(ImportService);
  private readonly avisos = inject(ToastService);
  private suscripcion: Subscription | null = null;

  protected readonly textoMotivo = TEXTO_MOTIVO_CESE;
  protected readonly fechaCorta = fechaCorta;
  protected readonly tamanoLegible = tamanoLegible;

  protected readonly fase = signal<Fase>('elegir');
  protected readonly archivo = signal<File | null>(null);
  protected readonly subida = signal<number | null>(null);
  protected readonly vista = signal<VistaImportacion | null>(null);
  protected readonly resultado = signal<ResultadoImportacion | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly arrastrando = signal(false);
  protected readonly importando = signal(false);
  protected readonly busqueda = signal('');
  protected readonly limite = signal(POR_PAGINA);

  protected readonly formato = computed(() => {
    const archivo = this.archivo();
    return archivo === null ? '' : formatoDe(archivo.name);
  });

  protected readonly resumen = computed(() => {
    const vista = this.vista();
    if (vista === null) {
      return null;
    }
    const listos = vista.validos.length;
    const observados = vista.observaciones.length;
    const conAvisos = vista.validos.filter((fila) => fila.avisos.length > 0).length;
    const avisos = vista.validos.flatMap((fila) => fila.avisos);
    return {
      total: vista.total,
      listos,
      observados,
      conAvisos,
      porcentaje: vista.total === 0 ? 0 : Math.round((listos / vista.total) * 1000) / 10,
      areasNuevas: new Set(avisos.filter((aviso) => aviso.startsWith('El área'))).size,
      cargosNuevos: new Set(avisos.filter((aviso) => aviso.startsWith('El cargo'))).size,
      cesados: vista.validos.filter((fila) => fila.estado === 'CESADO').length,
      extranjeria: vista.validos.filter((fila) => fila.tipoDocIdentidad === 'CE').length,
    };
  });

  protected readonly distribuciones = computed<Distribucion[]>(() => {
    const filas = this.vista()?.validos ?? [];
    if (filas.length === 0) {
      return [];
    }
    return [
      distribucion(
        'Régimen laboral',
        filas.map((fila) => fila.regimen),
      ),
      distribucion(
        'Tipo de personal',
        filas.map((fila) => TEXTO_TIPO_PERSONAL[fila.tipoPersonal]),
      ),
      distribucion(
        'Sexo',
        filas.map((fila) => (fila.sexo === 'F' ? 'Femenino' : fila.sexo === 'M' ? 'Masculino' : 'No indicado')),
      ),
      distribucion(
        'Áreas con más personal',
        filas.map((fila) => fila.area),
      ),
      distribucion(
        'Cargos más frecuentes',
        filas.map((fila) => fila.cargo),
      ),
      distribucion(
        'Ingreso por década',
        filas.map((fila) => {
          const decada = Math.floor(Number(fila.fechaIngreso.slice(0, 4)) / 10) * 10;
          return `${decada} – ${decada + 9}`;
        }),
        8,
        true,
      ),
    ];
  });

  protected readonly observaciones = computed<GrupoObservacion[]>(() => {
    const grupos = new Map<string, string[]>();
    for (const observacion of this.vista()?.observaciones ?? []) {
      const partes = /^Fila (\d+): (.*)$/.exec(observacion);
      const motivo = partes?.[2] ?? observacion;
      grupos.set(motivo, [...(grupos.get(motivo) ?? []), partes?.[1] ?? '']);
    }
    return [...grupos.entries()].map(([motivo, filas]) => ({ motivo, filas: filas.filter((fila) => fila !== '') }));
  });

  protected readonly filtradas = computed<FilaImportacion[]>(() => {
    const filas = this.vista()?.validos ?? [];
    const termino = normalizarTexto(this.busqueda());
    if (termino === '') {
      return filas;
    }
    return filas.filter((fila) =>
      normalizarTexto(
        `${fila.apellidoPaterno} ${fila.apellidoMaterno ?? ''} ${fila.nombres} ${fila.numeroDoc} ${fila.area} ${fila.cargo} ${fila.regimen}`,
      ).includes(termino),
    );
  });

  protected readonly visibles = computed(() => this.filtradas().slice(0, this.limite()));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.suscripcion?.unsubscribe());
  }

  protected descargarPlantilla(): void {
    const enlace = document.createElement('a');
    const url = URL.createObjectURL(new Blob(['﻿', PLANTILLA], { type: 'text/csv;charset=utf-8' }));
    enlace.href = url;
    enlace.download = 'plantilla-trabajadores.csv';
    enlace.click();
    URL.revokeObjectURL(url);
  }

  protected alArrastrar(evento: DragEvent, encima: boolean): void {
    evento.preventDefault();
    this.arrastrando.set(encima);
  }

  protected alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);
    this.recibir(evento.dataTransfer?.files.item(0) ?? null);
  }

  protected elegir(evento: Event): void {
    const entrada = evento.target;
    if (entrada instanceof HTMLInputElement) {
      this.recibir(entrada.files?.item(0) ?? null);
      entrada.value = '';
    }
  }

  protected buscar(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.busqueda.set(evento.target.value);
      this.limite.set(POR_PAGINA);
    }
  }

  protected verMas(): void {
    this.limite.update((actual) => actual + POR_PAGINA);
  }

  protected cancelarAnalisis(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.reiniciar();
  }

  protected reiniciar(): void {
    this.fase.set('elegir');
    this.archivo.set(null);
    this.vista.set(null);
    this.subida.set(null);
    this.error.set(null);
    this.busqueda.set('');
    this.limite.set(POR_PAGINA);
  }

  protected nuevaImportacion(): void {
    this.resultado.set(null);
    this.reiniciar();
  }

  protected async importar(): Promise<void> {
    const vista = this.vista();
    if (vista === null || vista.validos.length === 0 || this.importando()) {
      return;
    }
    this.importando.set(true);
    this.error.set(null);
    try {
      const resultado = await this.servicio.importar(vista.validos);
      this.resultado.set(resultado);
      this.fase.set('terminado');
      this.avisos.exito(`Se registraron ${resultado.importados} trabajadores.`);
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.importando.set(false);
    }
  }

  private recibir(archivo: File | null): void {
    if (archivo === null) {
      return;
    }
    this.error.set(null);
    if (!EXTENSIONES.test(archivo.name)) {
      this.error.set('El archivo debe ser .csv, .xlsx o el padrón .xls de INFORHUS.');
      return;
    }
    if (archivo.size > TAMANO_MAXIMO) {
      this.error.set(`El archivo pesa ${tamanoLegible(archivo.size)}. El máximo permitido es 5 MB.`);
      return;
    }
    this.archivo.set(archivo);
    this.vista.set(null);
    this.subida.set(0);
    this.fase.set('analizando');
    this.suscripcion?.unsubscribe();
    this.suscripcion = this.servicio.analizar(archivo).subscribe({
      next: (avance) => {
        if (avance.tipo === 'subiendo') {
          this.subida.set(avance.porcentaje);
        } else if (avance.tipo === 'analizando') {
          this.subida.set(null);
        } else {
          this.vista.set(avance.vista);
          this.fase.set('revisar');
        }
      },
      error: (error: unknown) => {
        this.error.set(mensajeDeError(error));
        this.fase.set('elegir');
        this.archivo.set(null);
      },
    });
  }
}
