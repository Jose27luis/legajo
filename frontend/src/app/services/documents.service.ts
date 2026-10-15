import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DetailedError, Upload } from 'tus-js-client';
import type { ConfirmacionCese, ConfirmacionMovimiento, DatosDocumento, Documento, EntradaHistorial, Legajo } from '../core/models';

export const TAMANO_MAXIMO_MB = 200;
const PARTE_BYTES = 8 * 1024 * 1024;

export interface SubidaEnCurso {
  terminada: Promise<string>;
  cancelar(): void;
}

export function mensajeDeSubida(error: unknown): string {
  if (error instanceof DetailedError) {
    const respuesta = error.originalResponse;
    if (respuesta === null) {
      return 'Se perdió la conexión durante la subida. Vuelve a intentarlo; continuará donde quedó.';
    }
    const cuerpo = respuesta.getBody().trim();
    if (cuerpo !== '' && cuerpo.length < 200 && !cuerpo.startsWith('<')) {
      return cuerpo;
    }
    if (respuesta.getStatus() === 413) {
      return 'El servidor rechazó el envío por tamaño, aunque el archivo está dentro del límite. Avisa al administrador del sistema.';
    }
  }
  return 'No se pudo subir el archivo. Intenta de nuevo.';
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly http = inject(HttpClient);

  legajo(trabajadorId: string): Promise<Legajo> {
    return firstValueFrom(this.http.get<Legajo>(`/api/workers/${trabajadorId}/legajo`));
  }

  registrar(trabajadorId: string, subidaId: string, datos: DatosDocumento, vinculoId: string | null = null): Promise<Documento> {
    return firstValueFrom(this.http.post<Documento>(`/api/workers/${trabajadorId}/documents`, { ...datos, subidaId, vinculoId }));
  }

  historial(id: string): Promise<EntradaHistorial[]> {
    return firstValueFrom(this.http.get<EntradaHistorial[]>(`/api/documents/${id}/history`));
  }

  vincular(id: string): Promise<Documento> {
    return firstValueFrom(this.http.post<Documento>(`/api/documents/${id}/link`, {}));
  }

  confirmarReingreso(id: string): Promise<Documento> {
    return firstValueFrom(this.http.post<Documento>(`/api/documents/${id}/confirm-reentry`, {}));
  }

  confirmarMovimiento(id: string, datos: ConfirmacionMovimiento): Promise<Documento> {
    return firstValueFrom(this.http.post<Documento>(`/api/documents/${id}/confirm-movement`, datos));
  }

  confirmarCese(id: string, datos: ConfirmacionCese): Promise<Documento> {
    return firstValueFrom(this.http.post<Documento>(`/api/documents/${id}/confirm-cese`, datos));
  }

  enlaceExpediente(trabajadorId: string, secciones: number[], portada: boolean): string {
    return `/api/workers/${trabajadorId}/dossier.pdf?sections=${secciones.join(',')}&cover=${portada ? '1' : '0'}`;
  }

  enlaceIndice(trabajadorId: string, secciones: number[]): string {
    return `/api/workers/${trabajadorId}/dossier-index.xlsx?sections=${secciones.join(',')}`;
  }

  editar(id: string, datos: DatosDocumento, motivo: string): Promise<Documento> {
    return firstValueFrom(this.http.patch<Documento>(`/api/documents/${id}`, { ...datos, motivo }));
  }

  anular(id: string, motivo: string): Promise<Documento> {
    return firstValueFrom(this.http.post<Documento>(`/api/documents/${id}/void`, { motivo }));
  }

  reemplazar(id: string, subidaId: string, motivo: string): Promise<Documento> {
    return firstValueFrom(this.http.post<Documento>(`/api/documents/${id}/replace`, { subidaId, motivo }));
  }

  reintentar(id: string): Promise<Documento> {
    return firstValueFrom(this.http.post<Documento>(`/api/documents/${id}/retry`, {}));
  }

  enlaceArchivo(id: string, descargar: boolean): string {
    return descargar ? `/api/documents/${id}/file?download=1` : `/api/documents/${id}/file`;
  }

  enlaceZip(trabajadorId: string, secciones: number[]): string {
    const base = `/api/workers/${trabajadorId}/zip`;
    return secciones.length === 0 ? base : `${base}?sections=${secciones.join(',')}`;
  }

  subir(archivo: File, alProgresar: (porcentaje: number) => void): SubidaEnCurso {
    let subida: Upload | null = null;
    const terminada = new Promise<string>((resolver, rechazar) => {
      const actual = new Upload(archivo, {
        endpoint: '/api/uploads',
        chunkSize: PARTE_BYTES,
        retryDelays: [0, 1000, 3000, 6000, 10000],
        removeFingerprintOnSuccess: true,
        headers: { 'X-Legajos': '1' },
        metadata: { filename: archivo.name, filetype: archivo.type || 'application/pdf' },
        onProgress: (enviados, total) => alProgresar(total === 0 ? 0 : Math.floor((enviados / total) * 100)),
        onSuccess: () => {
          const id = (actual.url ?? '').split('/').pop() ?? '';
          if (/^[a-f0-9]{32}$/.test(id)) {
            resolver(id);
          } else {
            rechazar(new Error('Respuesta de subida no válida'));
          }
        },
        onError: rechazar,
      });
      subida = actual;
      actual
        .findPreviousUploads()
        .then((previas) => {
          const previa = previas.at(0);
          if (previa !== undefined) {
            actual.resumeFromPreviousUpload(previa);
          }
          actual.start();
        })
        .catch(() => actual.start());
    });
    return {
      terminada,
      cancelar: () => {
        void subida?.abort();
      },
    };
  }
}
