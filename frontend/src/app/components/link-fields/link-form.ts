import { FormControl, FormGroup, Validators } from '@angular/forms';
import type { DatosNuevoVinculo, TipoPersonal, Vinculo } from '../../core/models';

export interface CamposVinculo {
  regimenId: FormControl<number | null>;
  tipoPersonal: FormControl<TipoPersonal | null>;
  cargoId: FormControl<number | null>;
  areaId: FormControl<number | null>;
  referencia: FormControl<string>;
}

export function crearCamposVinculo(): FormGroup<CamposVinculo> {
  return new FormGroup<CamposVinculo>({
    regimenId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    tipoPersonal: new FormControl<TipoPersonal | null>(null, { validators: [Validators.required] }),
    cargoId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    areaId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    referencia: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(160)] }),
  });
}

export function reiniciarCamposVinculo(grupo: FormGroup<CamposVinculo>, base: Vinculo | null): void {
  grupo.reset({
    regimenId: base?.regimen.id ?? null,
    tipoPersonal: base?.tipoPersonal ?? null,
    cargoId: base?.cargo.id ?? null,
    areaId: base?.area.id ?? null,
    referencia: '',
  });
}

export function leerCamposVinculo(grupo: FormGroup<CamposVinculo>): DatosNuevoVinculo | null {
  const { regimenId, tipoPersonal, cargoId, areaId, referencia } = grupo.getRawValue();
  if (regimenId === null || tipoPersonal === null || cargoId === null || areaId === null) {
    return null;
  }
  const texto = referencia.trim();
  return { regimenId, tipoPersonal, cargoId, areaId, referencia: texto === '' ? null : texto };
}
