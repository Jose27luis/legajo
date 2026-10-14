import { Injectable, signal } from '@angular/core';
import { TEXTO_MOTIVO_FIN, iniciales, nombreCompleto } from '../core/labels';
import type { EstadoTrabajador, Movimiento, TrabajadorDetalle } from '../core/models';

const CLAVE = 'legajos.trabajador';

export interface TrabajadorElegido {
  id: string;
  numeroDoc: string;
  tipoDocIdentidad: string;
  nombre: string;
  iniciales: string;
  estado: EstadoTrabajador;
  movimiento: Movimiento;
  regimen: string | null;
  cargo: string | null;
  area: string | null;
  motivoCese: string | null;
  fechaCese: string | null;
}

function leer(): TrabajadorElegido | null {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return guardado === null ? null : (JSON.parse(guardado) as TrabajadorElegido);
  } catch {
    return null;
  }
}

function guardar(trabajador: TrabajadorElegido | null): void {
  try {
    if (trabajador === null) {
      localStorage.removeItem(CLAVE);
    } else {
      localStorage.setItem(CLAVE, JSON.stringify(trabajador));
    }
  } catch {
    return;
  }
}

@Injectable({ providedIn: 'root' })
export class SelectedWorkerService {
  private readonly elegido = signal<TrabajadorElegido | null>(leer());

  readonly actual = this.elegido.asReadonly();

  fijar(trabajador: TrabajadorDetalle): void {
    const elegido: TrabajadorElegido = {
      id: trabajador.id,
      numeroDoc: trabajador.numeroDoc,
      tipoDocIdentidad: trabajador.tipoDocIdentidad,
      nombre: nombreCompleto(trabajador),
      iniciales: iniciales(trabajador),
      estado: trabajador.estado,
      movimiento: trabajador.movimientoActual,
      regimen: trabajador.vinculo?.regimen.nombre ?? null,
      cargo: trabajador.vinculo?.cargo.nombre ?? null,
      area: trabajador.vinculo?.area.nombre ?? null,
      motivoCese:
        trabajador.estado === 'CESADO' && trabajador.vinculo?.motivoFin != null ? TEXTO_MOTIVO_FIN[trabajador.vinculo.motivoFin] : null,
      fechaCese: trabajador.estado === 'CESADO' ? (trabajador.vinculo?.fechaFin ?? null) : null,
    };
    this.elegido.set(elegido);
    guardar(elegido);
  }

  limpiar(): void {
    this.elegido.set(null);
    guardar(null);
  }
}
