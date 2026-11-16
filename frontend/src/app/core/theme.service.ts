import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

interface OrigenCambio {
  clientX: number;
  clientY: number;
}

const CLAVE_TEMA = 'legajos.tema';
const CLASE_CAMBIO = 'cambiando-tema';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly documento = inject(DOCUMENT);

  readonly tema = signal<Tema>(this.guardado());

  constructor() {
    this.aplicar(this.tema());
  }

  alternar(origen?: OrigenCambio): void {
    const nuevo: Tema = this.tema() === 'oscuro' ? 'claro' : 'oscuro';
    this.tema.set(nuevo);
    this.guardar(nuevo);
    const raiz = this.documento.documentElement;
    const vista = this.documento.defaultView;
    const sinMovimiento = vista?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? true;
    if (sinMovimiento || vista == null || !('startViewTransition' in this.documento) || raiz.classList.contains(CLASE_CAMBIO)) {
      this.aplicar(nuevo);
      return;
    }
    const x = origen?.clientX ?? vista.innerWidth / 2;
    const y = origen?.clientY ?? 0;
    const radio = Math.hypot(Math.max(x, vista.innerWidth - x), Math.max(y, vista.innerHeight - y));
    raiz.style.setProperty('--tema-x', `${x}px`);
    raiz.style.setProperty('--tema-y', `${y}px`);
    raiz.style.setProperty('--tema-radio', `${radio}px`);
    raiz.classList.add(CLASE_CAMBIO);
    const transicion = this.documento.startViewTransition(() => this.aplicar(nuevo));
    void transicion.finished.finally(() => raiz.classList.remove(CLASE_CAMBIO));
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
