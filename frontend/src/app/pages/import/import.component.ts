import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import { TEXTO_MOTIVO_CESE, fechaCorta } from '../../core/labels';
import type { ResultadoImportacion, VistaImportacion } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ImportService } from '../../services/import.service';

const TAMANO_MAXIMO = 5 * 1024 * 1024;
const EXTENSIONES = /\.(csv|xlsx)$/i;

const PLANTILLA = [
  'dni;apellido_paterno;apellido_materno;nombres;tipo_personal;regimen;area;cargo;estado;fecha_ingreso;fecha_cese;motivo_cese',
  '00000000;APELLIDO;APELLIDO;NOMBRES;ADMINISTRATIVO;D.L. 276;Oficina de Personal;Técnico administrativo;ACTIVO;01/03/2020;;',
].join('\r\n');

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

  protected readonly textoMotivo = TEXTO_MOTIVO_CESE;
  protected readonly fechaCorta = fechaCorta;

  protected readonly archivo = signal<File | null>(null);
  protected readonly vista = signal<VistaImportacion | null>(null);
  protected readonly resultado = signal<ResultadoImportacion | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly validando = signal(false);
  protected readonly importando = signal(false);
  protected readonly conAvisos = computed(() => this.vista()?.validos.filter((fila) => fila.avisos.length > 0).length ?? 0);

  protected descargarPlantilla(): void {
    const enlace = document.createElement('a');
    const url = URL.createObjectURL(new Blob(['﻿', PLANTILLA], { type: 'text/csv;charset=utf-8' }));
    enlace.href = url;
    enlace.download = 'plantilla-trabajadores.csv';
    enlace.click();
    URL.revokeObjectURL(url);
  }

  protected elegir(evento: Event): void {
    this.vista.set(null);
    this.resultado.set(null);
    this.error.set(null);
    const entrada = evento.target;
    const elegido = entrada instanceof HTMLInputElement ? (entrada.files?.item(0) ?? null) : null;
    if (elegido !== null && !EXTENSIONES.test(elegido.name)) {
      this.error.set('El archivo debe ser .csv o .xlsx.');
      this.archivo.set(null);
      return;
    }
    if (elegido !== null && elegido.size > TAMANO_MAXIMO) {
      this.error.set('El archivo supera los 5 MB permitidos.');
      this.archivo.set(null);
      return;
    }
    this.archivo.set(elegido);
  }

  protected async validar(): Promise<void> {
    const archivo = this.archivo();
    if (archivo === null) {
      this.error.set('Selecciona un archivo .csv o .xlsx.');
      return;
    }
    this.validando.set(true);
    this.error.set(null);
    try {
      this.vista.set(await this.servicio.previsualizar(archivo));
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.validando.set(false);
    }
  }

  protected async importar(): Promise<void> {
    const vista = this.vista();
    if (vista === null || vista.validos.length === 0) {
      return;
    }
    this.importando.set(true);
    this.error.set(null);
    try {
      const resultado = await this.servicio.importar(vista.validos);
      this.resultado.set(resultado);
      this.vista.set(null);
      this.archivo.set(null);
      this.avisos.exito(`Se registraron ${resultado.importados} trabajadores.`);
    } catch (error: unknown) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.importando.set(false);
    }
  }

  protected cancelar(): void {
    this.vista.set(null);
    this.error.set(null);
  }
}
