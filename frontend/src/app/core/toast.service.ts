import { Injectable, signal } from '@angular/core';

export interface Aviso {
  id: number;
  mensaje: string;
  tipo: 'exito' | 'error';
}

const DURACION_MS = 4500;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private siguienteId = 1;
  private readonly lista = signal<Aviso[]>([]);

  readonly avisos = this.lista.asReadonly();

  exito(mensaje: string): void {
    this.agregar(mensaje, 'exito');
  }

  error(mensaje: string): void {
    this.agregar(mensaje, 'error');
  }

  cerrar(id: number): void {
    this.lista.update((avisos) => avisos.filter((aviso) => aviso.id !== id));
  }

  private agregar(mensaje: string, tipo: Aviso['tipo']): void {
    const id = this.siguienteId;
    this.siguienteId += 1;
    this.lista.update((avisos) => [...avisos.slice(-2), { id, mensaje, tipo }]);
    setTimeout(() => this.cerrar(id), DURACION_MS);
  }
}
