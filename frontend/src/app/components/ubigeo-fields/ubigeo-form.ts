import { FormControl, FormGroup } from '@angular/forms';
import { normalizarTexto } from '../../core/format';
import type { DepartamentoUbigeo } from '../../core/models';

export interface CamposUbigeo {
  departamento: FormControl<string>;
  provincia: FormControl<string>;
  distrito: FormControl<string>;
}

export interface Ubicacion {
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
}

export function crearCamposUbigeo(): FormGroup<CamposUbigeo> {
  return new FormGroup<CamposUbigeo>({
    departamento: new FormControl('', { nonNullable: true }),
    provincia: new FormControl('', { nonNullable: true }),
    distrito: new FormControl('', { nonNullable: true }),
  });
}

export function ubicarEnLista(
  lista: readonly DepartamentoUbigeo[],
  ubicacion: Ubicacion,
): { departamento: string; provincia: string; distrito: string } {
  const igual = (nombre: string, buscado: string | null): boolean =>
    buscado !== null && normalizarTexto(nombre) === normalizarTexto(buscado);
  const lugar = lista.find((item) => igual(item.nombre, ubicacion.departamento));
  const zona = lugar?.provincias.find((item) => igual(item.nombre, ubicacion.provincia));
  const distrito = zona?.distritos.find((nombre) => igual(nombre, ubicacion.distrito));
  return { departamento: lugar?.nombre ?? '', provincia: zona?.nombre ?? '', distrito: distrito ?? '' };
}

export function leerCamposUbigeo(grupo: FormGroup<CamposUbigeo>): Ubicacion {
  const { departamento, provincia, distrito } = grupo.getRawValue();
  return {
    departamento: departamento === '' ? null : departamento,
    provincia: provincia === '' ? null : provincia,
    distrito: distrito === '' ? null : distrito,
  };
}
