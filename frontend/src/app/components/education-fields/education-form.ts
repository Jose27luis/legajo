import { FormControl, FormGroup } from '@angular/forms';
import type { Formacion } from '../../core/models';

export interface CamposFormacion {
  gradoInstruccion: FormControl<string>;
  profesion: FormControl<string>;
  condicionProfesion: FormControl<string>;
}

export function crearCamposFormacion(): FormGroup<CamposFormacion> {
  return new FormGroup<CamposFormacion>({
    gradoInstruccion: new FormControl('', { nonNullable: true }),
    profesion: new FormControl('', { nonNullable: true }),
    condicionProfesion: new FormControl('', { nonNullable: true }),
  });
}

export function reiniciarCamposFormacion(grupo: FormGroup<CamposFormacion>, base: Formacion | null): void {
  grupo.reset({
    gradoInstruccion: base?.gradoInstruccion ?? '',
    profesion: base?.profesion ?? '',
    condicionProfesion: base?.condicionProfesion ?? '',
  });
}

export function leerCamposFormacion(grupo: FormGroup<CamposFormacion>): Formacion {
  const { gradoInstruccion, profesion, condicionProfesion } = grupo.getRawValue();
  return {
    gradoInstruccion: gradoInstruccion === '' ? null : gradoInstruccion,
    profesion: profesion === '' ? null : profesion,
    condicionProfesion: condicionProfesion === '' ? null : condicionProfesion,
  };
}
