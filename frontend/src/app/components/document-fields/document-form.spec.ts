import type { CampoSeccion, SeccionLegajo, TipoDocumento } from '../../core/models';
import {
  INCORPORACION,
  campoObligatorio,
  crearFormularioDocumento,
  esCurriculum,
  leerFormularioDocumento,
  sincronizarCampos,
} from './document-form';

function tipo(cambios: Partial<TipoDocumento>): TipoDocumento {
  return {
    id: 1,
    seccionId: 2,
    codigo: '0202',
    nombre: 'Contrato administrativo de servicios',
    restringido: false,
    requiereNumero: false,
    tieneVencimiento: false,
    activo: true,
    orden: 1,
    accion: 'NINGUNA',
    campos: [],
    ...cambios,
  };
}

const CAMPOS_VINCULO: CampoSeccion[] = [
  { clave: 'tipoIncorporacion', etiqueta: 'Tipo de incorporación', tipo: 'seleccion', obligatorio: false, opciones: Object.values(INCORPORACION) },
  { clave: 'regimen', etiqueta: 'Régimen', tipo: 'regimen', obligatorio: false },
  { clave: 'inicio', etiqueta: 'Inicio', tipo: 'fecha', obligatorio: false },
  { clave: 'fin', etiqueta: 'Fin', tipo: 'fecha', obligatorio: false },
];

function seccion(tipos: TipoDocumento[], campos: CampoSeccion[] = []): SeccionLegajo {
  return { id: 2, numero: 2, nombre: 'Incorporación', descripcion: '', campos, tipos, total: 0, restringida: false };
}

function formulario(seccionActual: SeccionLegajo, tipoActual: TipoDocumento) {
  const form = crearFormularioDocumento();
  sincronizarCampos(form, seccionActual, tipoActual, {});
  form.controls.tipoDocumentoId.setValue(tipoActual.id);
  return form;
}

describe('esCurriculum', () => {
  it('reconoce el currículum por su nombre', () => {
    expect(esCurriculum(tipo({ nombre: 'Currículum vitae documentado' }))).toBe(true);
    expect(esCurriculum(tipo({ nombre: 'CV' }))).toBe(true);
    expect(esCurriculum(tipo({ nombre: 'Resolución' }))).toBe(false);
    expect(esCurriculum(null)).toBe(false);
  });
});

describe('campoObligatorio', () => {
  const vinculo = tipo({ accion: 'VINCULO', campos: CAMPOS_VINCULO });

  it('exige los datos del vínculo cuando el documento crea uno', () => {
    expect(campoObligatorio(CAMPOS_VINCULO[0], vinculo, false)).toBe(true);
    expect(campoObligatorio(CAMPOS_VINCULO[1], vinculo, false)).toBe(true);
    expect(campoObligatorio(CAMPOS_VINCULO[3], vinculo, false)).toBe(false);
  });

  it('no los exige cuando el documento se adjunta a un vínculo existente', () => {
    expect(campoObligatorio(CAMPOS_VINCULO[0], vinculo, true)).toBe(false);
  });
});

describe('sincronizarCampos', () => {
  it('agrega los campos de la sección y del tipo y quita los que sobran', () => {
    const form = crearFormularioDocumento();
    form.controls.datos.addControl('sobrante', crearFormularioDocumento().controls.numero);
    const propio: CampoSeccion = { clave: 'emisorInterno', etiqueta: 'Emisor', tipo: 'texto', obligatorio: true };
    sincronizarCampos(form, seccion([], [propio]), tipo({ campos: CAMPOS_VINCULO }), { inicio: '2026-01-01' });
    expect(Object.keys(form.controls.datos.controls).sort()).toEqual(['emisorInterno', 'fin', 'inicio', 'regimen', 'tipoIncorporacion']);
    expect(form.controls.datos.controls['inicio']?.value).toBe('2026-01-01');
    expect(form.controls.datos.controls['emisorInterno']?.hasError('required')).toBe(true);
  });
});

describe('leerFormularioDocumento', () => {
  it('pide el tipo de documento', () => {
    const actual = tipo({});
    const form = formulario(seccion([actual]), actual);
    form.controls.tipoDocumentoId.setValue(null);
    expect(leerFormularioDocumento(form, seccion([actual]))).toBe('Selecciona el tipo de documento.');
  });

  it('exige el número cuando el tipo lo requiere', () => {
    const actual = tipo({ requiereNumero: true });
    expect(leerFormularioDocumento(formulario(seccion([actual]), actual), seccion([actual]))).toBe('Este tipo de documento exige su número.');
  });

  it('rechaza un vencimiento anterior a la emisión', () => {
    const actual = tipo({});
    const form = formulario(seccion([actual]), actual);
    form.patchValue({ fechaEmision: '2026-05-01', fechaVencimiento: '2026-04-01' });
    expect(leerFormularioDocumento(form, seccion([actual]))).toBe('El vencimiento no puede ser anterior a la emisión.');
  });

  it('exige los datos del vínculo y rechaza un término anterior al inicio', () => {
    const actual = tipo({ accion: 'VINCULO', campos: CAMPOS_VINCULO });
    const secc = seccion([actual]);
    const form = formulario(secc, actual);
    expect(leerFormularioDocumento(form, secc)).toBe('Completa el campo "Tipo de incorporación".');
    form.controls.datos.patchValue({ tipoIncorporacion: INCORPORACION.primerIngreso, regimen: '3', inicio: '2026-05-01', fin: '2026-01-01' });
    expect(leerFormularioDocumento(form, secc)).toBe('La fecha de término no puede ser anterior a la fecha de inicio.');
  });

  it('devuelve los datos limpios, con catálogos numéricos', () => {
    const actual = tipo({ accion: 'VINCULO', campos: CAMPOS_VINCULO });
    const secc = seccion([actual]);
    const form = formulario(secc, actual);
    form.patchValue({ numero: '  001-2026  ', emisor: '' });
    form.controls.datos.patchValue({ tipoIncorporacion: INCORPORACION.renovacion, regimen: '3', inicio: '2026-01-01', fin: '' });
    const resultado = leerFormularioDocumento(form, secc);
    expect(resultado).toEqual({
      tipoDocumentoId: 1,
      numero: '001-2026',
      fechaEmision: null,
      fechaVencimiento: null,
      emisor: null,
      observaciones: null,
      ubicacionFisica: null,
      nivelAcceso: 'NORMAL',
      datos: { tipoIncorporacion: INCORPORACION.renovacion, regimen: 3, inicio: '2026-01-01', fin: null },
    });
  });

  it('no guarda número para un currículum', () => {
    const actual = tipo({ nombre: 'Currículum vitae' });
    const form = formulario(seccion([actual]), actual);
    form.patchValue({ numero: '123' });
    const resultado = leerFormularioDocumento(form, seccion([actual]));
    expect(typeof resultado === 'string' ? resultado : resultado.numero).toBeNull();
  });

  it('eleva a restringido un documento de tipo restringido', () => {
    const actual = tipo({ restringido: true });
    const resultado = leerFormularioDocumento(formulario(seccion([actual]), actual), seccion([actual]));
    expect(typeof resultado === 'string' ? resultado : resultado.nivelAcceso).toBe('RESTRINGIDO');
  });
});
