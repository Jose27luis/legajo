import { FormControl, FormGroup, FormRecord, Validators } from '@angular/forms';
import type { DatosDocumento, Documento, NivelAcceso, SeccionLegajo, ValorCampo } from '../../core/models';

export type FormularioDocumento = FormGroup<{
  tipoDocumentoId: FormControl<number | null>;
  numero: FormControl<string>;
  fechaEmision: FormControl<string>;
  fechaVencimiento: FormControl<string>;
  emisor: FormControl<string>;
  observaciones: FormControl<string>;
  ubicacionFisica: FormControl<string>;
  nivelAcceso: FormControl<NivelAcceso>;
  datos: FormRecord<FormControl<string>>;
}>;

const opcional = (valor: string): string | null => {
  const limpio = valor.trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
};

export function crearFormularioDocumento(): FormularioDocumento {
  return new FormGroup({
    tipoDocumentoId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    numero: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
    fechaEmision: new FormControl('', { nonNullable: true }),
    fechaVencimiento: new FormControl('', { nonNullable: true }),
    emisor: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(160)] }),
    observaciones: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    ubicacionFisica: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    nivelAcceso: new FormControl<NivelAcceso>('NORMAL', { nonNullable: true }),
    datos: new FormRecord<FormControl<string>>({}),
  });
}

export function prepararFormularioDocumento(
  formulario: FormularioDocumento,
  seccion: SeccionLegajo,
  documento: Documento | null,
): void {
  const datos = formulario.controls.datos;
  for (const clave of Object.keys(datos.controls)) {
    datos.removeControl(clave, { emitEvent: false });
  }
  for (const campo of seccion.campos) {
    const guardado = documento?.datos[campo.clave] ?? null;
    datos.addControl(
      campo.clave,
      new FormControl(guardado === null ? '' : String(guardado), {
        nonNullable: true,
        validators: campo.obligatorio ? [Validators.required] : [],
      }),
      { emitEvent: false },
    );
  }
  formulario.reset({
    tipoDocumentoId: documento?.tipo.id ?? (seccion.tipos.length === 1 ? seccion.tipos[0].id : null),
    numero: documento?.numero ?? '',
    fechaEmision: documento?.fechaEmision ?? '',
    fechaVencimiento: documento?.fechaVencimiento ?? '',
    emisor: documento?.emisor ?? '',
    observaciones: documento?.observaciones ?? '',
    ubicacionFisica: documento?.ubicacionFisica ?? '',
    nivelAcceso: documento?.nivelAcceso ?? 'NORMAL',
  });
}

export function leerFormularioDocumento(formulario: FormularioDocumento, seccion: SeccionLegajo): DatosDocumento | string {
  formulario.markAllAsTouched();
  const valores = formulario.getRawValue();
  const tipo = seccion.tipos.find((item) => item.id === valores.tipoDocumentoId);
  if (tipo === undefined) {
    return 'Selecciona el tipo de documento.';
  }
  if (tipo.requiereNumero && valores.numero.trim() === '') {
    return 'Este tipo de documento exige su número.';
  }
  if (formulario.invalid) {
    return 'Revisa los campos marcados.';
  }
  if (valores.fechaVencimiento !== '' && valores.fechaEmision !== '' && valores.fechaVencimiento < valores.fechaEmision) {
    return 'El vencimiento no puede ser anterior a la emisión.';
  }
  const datos: Record<string, ValorCampo> = {};
  for (const campo of seccion.campos) {
    const valor = opcional(valores.datos[campo.clave] ?? '');
    datos[campo.clave] = valor !== null && campo.tipo === 'numero' ? Number(valor) : valor;
  }
  return {
    tipoDocumentoId: tipo.id,
    numero: opcional(valores.numero),
    fechaEmision: opcional(valores.fechaEmision),
    fechaVencimiento: tipo.tieneVencimiento ? opcional(valores.fechaVencimiento) : null,
    emisor: opcional(valores.emisor),
    observaciones: opcional(valores.observaciones),
    ubicacionFisica: opcional(valores.ubicacionFisica),
    nivelAcceso: tipo.restringido && valores.nivelAcceso === 'NORMAL' ? 'RESTRINGIDO' : valores.nivelAcceso,
    datos,
  };
}
