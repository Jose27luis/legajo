import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

const CLAVE_TEMA = 'legajos.tema';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly documento = inject(DOCUMENT);

  readonly tema = signal<Tema>(this.guardado());

  constructor() {
    this.aplicar(this.tema());
  }

  alternar(): void {
    const nuevo: Tema = this.tema() === 'oscuro' ? 'claro' : 'oscuro';
    this.tema.set(nuevo);
    this.aplicar(nuevo);
    this.guardar(nuevo);
  }

  private aplicar(tema: Tema): void {
    this.documento.documentElement.dataset['tema'] = tema;
  }

  private guardado(): Tema {
    try {
      return this.documento.defaultView?.localStorage.getItem(CLAVE_TEMA) === 'oscuro' ? 'oscuro' : 'claro';
    } catch {
      return 'claro';
    }
  }

  private guardar(tema: Tema): void {
    try {
      this.documento.defaultView?.localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
      return;
    }
  }
}
