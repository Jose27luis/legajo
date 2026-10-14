import { FormControl, FormGroup, FormRecord, Validators } from '@angular/forms';
import type { CampoSeccion, DatosDocumento, Documento, NivelAcceso, SeccionLegajo, TipoDocumento, ValorCampo } from '../../core/models';

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

export const INCORPORACION = {
  primerIngreso: 'Primer ingreso',
  reingreso: 'Reingreso',
  renovacion: 'Renovación o continuidad',
} as const;

const CAMPOS_NUMERICOS = new Set(['regimen', 'area', 'cargo', 'numero']);
const OBLIGATORIOS_DEL_VINCULO = new Set(['tipoIncorporacion', 'regimen', 'inicio']);

const opcional = (valor: string): string | null => {
  const limpio = valor.trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
};

export function esCurriculum(tipo: TipoDocumento | null): boolean {
  return tipo !== null && /curr[ií]culum|\bcv\b/i.test(tipo.nombre);
}

export function campoObligatorio(campo: CampoSeccion, tipo: TipoDocumento | null, conVinculo: boolean): boolean {
  return campo.obligatorio || (tipo?.accion === 'VINCULO' && !conVinculo && OBLIGATORIOS_DEL_VINCULO.has(campo.clave));
}

export function camposDelDocumento(seccion: SeccionLegajo, tipo: TipoDocumento | null): CampoSeccion[] {
  return [...seccion.campos, ...(tipo?.campos ?? [])];
}

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

export function sincronizarCampos(
  formulario: FormularioDocumento,
  seccion: SeccionLegajo,
  tipo: TipoDocumento | null,
  guardados: Record<string, ValorCampo>,
): void {
  const datos = formulario.controls.datos;
  const campos = camposDelDocumento(seccion, tipo);
  const claves = new Set(campos.map((campo) => campo.clave));
  for (const clave of Object.keys(datos.controls)) {
    if (!claves.has(clave)) {
      datos.removeControl(clave, { emitEvent: false });
    }
  }
  for (const campo of campos) {
    if (datos.contains(campo.clave)) {
      continue;
    }
    const guardado = guardados[campo.clave] ?? null;
    datos.addControl(
      campo.clave,
      new FormControl(guardado === null ? '' : String(guardado), {
        nonNullable: true,
        validators: campo.obligatorio ? [Validators.required] : [],
      }),
      { emitEvent: false },
    );
  }
}

export function prepararFormularioDocumento(
  formulario: FormularioDocumento,
  seccion: SeccionLegajo,
  documento: Documento | null,
): void {
  const tipoId = documento?.tipo.id ?? (seccion.tipos.length === 1 ? seccion.tipos[0].id : null);
  const tipo = seccion.tipos.find((item) => item.id === tipoId) ?? documento?.tipo ?? null;
  for (const clave of Object.keys(formulario.controls.datos.controls)) {
    formulario.controls.datos.removeControl(clave, { emitEvent: false });
  }
  sincronizarCampos(formulario, seccion, tipo, documento?.datos ?? {});
  formulario.reset(
    {
      tipoDocumentoId: tipoId,
      numero: documento?.numero ?? '',
      fechaEmision: documento?.fechaEmision ?? '',
      fechaVencimiento: documento?.fechaVencimiento ?? '',
      emisor: documento?.emisor ?? '',
      observaciones: documento?.observaciones ?? '',
      ubicacionFisica: documento?.ubicacionFisica ?? '',
      nivelAcceso: documento?.nivelAcceso ?? 'NORMAL',
    },
    { emitEvent: false },
  );
  for (const [clave, control] of Object.entries(formulario.controls.datos.controls)) {
    const guardado = documento?.datos[clave] ?? null;
    control.setValue(guardado === null ? '' : String(guardado), { emitEvent: false });
  }
}

export function leerFormularioDocumento(
  formulario: FormularioDocumento,
  seccion: SeccionLegajo,
  conVinculo = false,
): DatosDocumento | string {
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
  for (const campo of camposDelDocumento(seccion, tipo)) {
    const valor = opcional(valores.datos[campo.clave] ?? '');
    if (valor === null && campoObligatorio(campo, tipo, conVinculo)) {
      return `Completa el campo "${campo.etiqueta}".`;
    }
    datos[campo.clave] = valor !== null && CAMPOS_NUMERICOS.has(campo.tipo) ? Number(valor) : valor;
  }
  const inicio = datos['inicio'];
  const fin = datos['fin'];
  if (typeof inicio === 'string' && typeof fin === 'string' && fin < inicio) {
    return 'La fecha de término no puede ser anterior a la fecha de inicio.';
  }
  return {
    tipoDocumentoId: tipo.id,
    numero: esCurriculum(tipo) ? null : opcional(valores.numero),
    fechaEmision: opcional(valores.fechaEmision),
    fechaVencimiento: opcional(valores.fechaVencimiento),
    emisor: opcional(valores.emisor),
    observaciones: opcional(valores.observaciones),
    ubicacionFisica: opcional(valores.ubicacionFisica),
    nivelAcceso: tipo.restringido && valores.nivelAcceso === 'NORMAL' ? 'RESTRINGIDO' : valores.nivelAcceso,
    datos,
  };
}
