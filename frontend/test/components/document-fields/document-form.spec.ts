import type { CampoSeccion, Documento, SeccionLegajo, TipoDocumento } from '../../../src/app/core/models';
import {
  crearFormularioDocumento,
  leerFormularioDocumento,
  opcionesContrato,
  opcionesDependientes,
  sincronizarCampos,
} from '../../../src/app/components/document-fields/document-form';

function documento(cambios: Partial<Documento>): Documento {
  return {
    id: 'documento',
    seccion: 2,
    tipo: tipo({}),
    numero: '970-2016',
    fechaEmision: '2016-11-01',
    fechaVencimiento: null,
    emisor: null,
    observaciones: null,
    ubicacionFisica: null,
    datos: {},
    nivelAcceso: 'NORMAL',
    estado: 'DISPONIBLE',
    detalleError: null,
    motivoAnulacion: null,
    creadoPor: 'Administrador',
    creadoEn: '2026-10-22T10:00:00.000Z',
    modificadoPor: null,
    modificadoEn: null,
    motivoModificacion: null,
    reintentable: false,
    editable: true,
    versiones: [],
    vinculoId: null,
    confirmadoPor: null,
    confirmadoEn: null,
    movimientoId: null,
    ...cambios,
  };
}

function tipo(cambios: Partial<TipoDocumento>): TipoDocumento {
  return {
    id: 1,
    seccionId: 2,
    codigo: '0206',
    nombre: 'Contrato',
    restringido: false,
    requiereNumero: false,
    tieneVencimiento: false,
    activo: true,
    orden: 1,
    accion: 'NINGUNA',
    campos: [],
    formulario: { numero: 'Número de contrato', fechaEmision: 'Fecha de emisión' },
    ...cambios,
  };
}

const CAMPOS_CONTRATO: CampoSeccion[] = [
  { clave: 'regimen', etiqueta: 'Régimen o modalidad', tipo: 'regimen', obligatorio: false },
  { clave: 'inicio', etiqueta: 'Inicio del vínculo', tipo: 'fecha', obligatorio: false },
  { clave: 'fin', etiqueta: 'Fin del vínculo', tipo: 'fecha', obligatorio: false },
];

const MOTIVO: CampoSeccion = {
  clave: 'motivoSolicitud',
  etiqueta: 'Motivo de licencia o permiso',
  tipo: 'seleccion',
  opciones: ['Licencia por Maternidad', 'Permiso por Lactancia materna'],
  dependeDe: { clave: 'tipoSolicitud', opciones: { Licencia: ['Licencia por Maternidad'], Permiso: ['Permiso por Lactancia materna'] } },
  obligatorio: false,
};

const SOLICITUD: CampoSeccion = {
  clave: 'tipoSolicitud',
  etiqueta: 'Tipo de solicitud',
  tipo: 'seleccion',
  opciones: ['Licencia', 'Permiso'],
  obligatorio: false,
};

function seccion(tipos: TipoDocumento[], campos: CampoSeccion[] = []): SeccionLegajo {
  return { id: 2, numero: 2, nombre: 'Incorporación', descripcion: '', campos, tipos, total: 0, restringida: false };
}

function formulario(seccionActual: SeccionLegajo, tipoActual: TipoDocumento) {
  const form = crearFormularioDocumento();
  sincronizarCampos(form, seccionActual, tipoActual, {});
  form.controls.tipoDocumentoId.setValue(tipoActual.id);
  return form;
}

describe('opcionesDependientes', () => {
  it('limita las opciones según el campo del que depende', () => {
    expect(opcionesDependientes(MOTIVO, 'Licencia')).toEqual(['Licencia por Maternidad']);
    expect(opcionesDependientes(MOTIVO, 'Permiso')).toEqual(['Permiso por Lactancia materna']);
    expect(opcionesDependientes(MOTIVO, '')).toEqual(MOTIVO.opciones);
  });
});

describe('opcionesContrato', () => {
  it('lista los contratos vigentes del trabajador sin las adendas ni los anulados', () => {
    const adenda = tipo({
      id: 2,
      accion: 'VINCULO',
      nombre: 'Adenda',
      campos: [{ clave: 'contratoRelacionado', etiqueta: 'Contrato relacionado', tipo: 'contrato', obligatorio: false }],
    });
    const documentos = [
      documento({ id: 'a', tipo: tipo({ accion: 'VINCULO' }) }),
      documento({ id: 'b', tipo: adenda }),
      documento({ id: 'c', tipo: tipo({ accion: 'VINCULO' }), estado: 'ANULADO' }),
      documento({ id: 'd', tipo: tipo({ accion: 'NINGUNA' }) }),
    ];
    expect(opcionesContrato(documentos)).toEqual([{ valor: 'a', etiqueta: 'Contrato N.º 970-2016', detalle: '2016-11-01' }]);
  });
});

describe('sincronizarCampos', () => {
  it('agrega los campos de la sección y del tipo y quita los que sobran', () => {
    const form = crearFormularioDocumento();
    form.controls.datos.addControl('sobrante', crearFormularioDocumento().controls.numero);
    const propio: CampoSeccion = { clave: 'emisorInterno', etiqueta: 'Emisor', tipo: 'texto', obligatorio: true };
    sincronizarCampos(form, seccion([], [propio]), tipo({ campos: CAMPOS_CONTRATO }), { inicio: '2026-01-01' });
    expect(Object.keys(form.controls.datos.controls).sort()).toEqual(['emisorInterno', 'fin', 'inicio', 'regimen']);
    expect(form.controls.datos.controls['inicio']?.value).toBe('2026-01-01');
    expect(form.controls.datos.controls['emisorInterno']?.hasError('required')).toBe(true);
  });

  it('bloquea el formulario hasta elegir el tipo y luego muestra los campos del tipo', () => {
    const form = crearFormularioDocumento();
    const actual = tipo({ accion: 'VINCULO', campos: CAMPOS_CONTRATO });
    sincronizarCampos(form, seccion([actual]), null, {});
    expect(form.controls.tipoDocumentoId.enabled).toBe(true);
    expect(form.controls.numero.disabled).toBe(true);
    expect(form.controls.observaciones.disabled).toBe(true);
    expect(Object.keys(form.controls.datos.controls)).toEqual([]);
    sincronizarCampos(form, seccion([actual]), actual, {});
    expect(form.controls.numero.enabled).toBe(true);
    expect(form.controls.datos.controls['regimen']?.enabled).toBe(true);
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
    expect(leerFormularioDocumento(formulario(seccion([actual]), actual), seccion([actual]))).toBe(
      'Este tipo de documento exige su número.',
    );
  });

  it('rechaza un vencimiento anterior a la emisión', () => {
    const actual = tipo({});
    const form = formulario(seccion([actual]), actual);
    form.patchValue({ fechaEmision: '2026-05-01', fechaVencimiento: '2026-04-01' });
    expect(leerFormularioDocumento(form, seccion([actual]))).toBe('El vencimiento no puede ser anterior a la emisión.');
  });

  it('acepta un contrato sin datos del vínculo y rechaza un término anterior al inicio', () => {
    const actual = tipo({ accion: 'VINCULO', campos: CAMPOS_CONTRATO });
    const secc = seccion([actual]);
    const form = formulario(secc, actual);
    expect(typeof leerFormularioDocumento(form, secc)).toBe('object');
    form.controls.datos.patchValue({ regimen: '3', inicio: '2026-05-01', fin: '2026-01-01' });
    expect(leerFormularioDocumento(form, secc)).toBe('La fecha de término no puede ser anterior a la fecha de inicio.');
  });

  it('rechaza un motivo que no corresponde al tipo de solicitud', () => {
    const actual = tipo({ campos: [SOLICITUD, MOTIVO] });
    const secc = seccion([actual]);
    const form = formulario(secc, actual);
    form.controls.datos.patchValue({ tipoSolicitud: 'Permiso', motivoSolicitud: 'Licencia por Maternidad' });
    expect(leerFormularioDocumento(form, secc)).toBe('"Motivo de licencia o permiso" no corresponde a lo elegido antes.');
  });

  it('devuelve los datos limpios, con catálogos numéricos', () => {
    const actual = tipo({ accion: 'VINCULO', campos: CAMPOS_CONTRATO });
    const secc = seccion([actual]);
    const form = formulario(secc, actual);
    form.patchValue({ numero: '  001-2026  ', emisor: '' });
    form.controls.datos.patchValue({ regimen: '3', inicio: '2026-01-01', fin: '' });
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
      datos: { regimen: 3, inicio: '2026-01-01', fin: null },
    });
  });

  it('eleva a restringido un documento de tipo restringido', () => {
    const actual = tipo({ restringido: true });
    const resultado = leerFormularioDocumento(formulario(seccion([actual]), actual), seccion([actual]));
    expect(typeof resultado === 'string' ? resultado : resultado.nivelAcceso).toBe('RESTRINGIDO');
  });
});
