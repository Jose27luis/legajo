export type TipoCampo = 'texto' | 'fecha' | 'numero' | 'seleccion' | 'parrafo' | 'regimen' | 'area' | 'cargo';

export type AccionTipo = 'NINGUNA' | 'VINCULO' | 'MOVIMIENTO' | 'CESE';

export type CampoSeccion = {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  obligatorio: boolean;
};

export interface SeccionSemilla {
  numero: number;
  nombre: string;
  carpeta: string;
  descripcion: string;
  campos: CampoSeccion[];
}

const texto = (clave: string, etiqueta: string, obligatorio = false): CampoSeccion => ({
  clave,
  etiqueta,
  tipo: 'texto',
  obligatorio,
});
const fecha = (clave: string, etiqueta: string, obligatorio = false): CampoSeccion => ({ clave, etiqueta, tipo: 'fecha', obligatorio });
const seleccion = (clave: string, etiqueta: string, opciones: string[], obligatorio = false): CampoSeccion => ({
  clave,
  etiqueta,
  tipo: 'seleccion',
  opciones,
  obligatorio,
});
const catalogo = (clave: string, etiqueta: string, tipo: 'regimen' | 'area' | 'cargo', obligatorio = false): CampoSeccion => ({
  clave,
  etiqueta,
  tipo,
  obligatorio,
});

export const TIPOS_MOVIMIENTO = ['Rotación', 'Destaque', 'Reasignación', 'Encargatura', 'Designación', 'Cambio de funciones', 'Otro'];
export const MOTIVOS_CESE = ['Renuncia', 'Jubilación', 'Fallecimiento', 'Fin de contrato', 'Destitución', 'Otra causa'];
export const TIPOS_INCORPORACION = ['Primer ingreso', 'Reingreso', 'Renovación o continuidad'];

export const SECCIONES: readonly SeccionSemilla[] = [
  {
    numero: 1,
    nombre: 'Información personal y familiar',
    carpeta: '01_Informacion_Personal_y_Familiar',
    descripcion:
      'Datos personales, contacto autorizado, régimen, puesto, unidad orgánica, condición laboral, períodos de servicio y eventos de cese o reingreso.',
    campos: [],
  },
  {
    numero: 2,
    nombre: 'Incorporación',
    carpeta: '02_Incorporacion',
    descripcion: 'Documentos de ingreso a la entidad, currículum, contratos, adendas y anexos de incorporación.',
    campos: [],
  },
  {
    numero: 3,
    nombre: 'Formación académica y capacitación',
    carpeta: '03_Formacion_Academica_y_Capacitacion',
    descripcion: 'Grados, títulos, colegiatura, habilitación, capacitaciones, certificaciones y SERUMS cuando corresponda.',
    campos: [
      texto('institucion', 'Institución formadora o emisora'),
      texto('programa', 'Carrera, especialidad o curso'),
      fecha('fechaCulminacion', 'Fecha de culminación, si aplica'),
      texto('colegioProfesional', 'Colegio profesional, si aplica'),
      texto('numeroColegiatura', 'Número de colegiatura, si aplica'),
    ],
  },
  {
    numero: 4,
    nombre: 'Experiencia laboral',
    carpeta: '04_Experiencia_Laboral',
    descripcion: 'Documentos que acreditan experiencia previa o servicios desempeñados dentro o fuera de la entidad.',
    campos: [
      texto('entidad', 'Entidad donde trabajó'),
      texto('cargo', 'Cargo desempeñado'),
      fecha('inicioPeriodo', 'Inicio del período laboral'),
      fecha('finPeriodo', 'Fin del período laboral'),
    ],
  },
  {
    numero: 5,
    nombre: 'Movimientos del personal',
    carpeta: '05_Movimientos_del_Personal',
    descripcion:
      'Resoluciones o memorandos de desplazamiento, rotación, encargatura, destaque, reasignación y designación.',
    campos: [
      seleccion('tipoMovimiento', 'Tipo de movimiento', TIPOS_MOVIMIENTO),
      catalogo('areaOrigen', 'Área de origen', 'area'),
      catalogo('areaDestino', 'Área de destino', 'area'),
      fecha('fechaEfecto', 'Fecha efectiva del movimiento'),
    ],
  },
  {
    numero: 6,
    nombre: 'Compensaciones',
    carpeta: '06_Compensaciones',
    descripcion:
      'Documentos administrativos de beneficios, asignaciones y otros conceptos autorizados, sin desarrollar un módulo de planillas.',
    campos: [
      texto('concepto', 'Concepto del beneficio'),
      texto('periodo', 'Período de referencia'),
      fecha('fechaEfecto', 'Fecha de efecto'),
      texto('referencia', 'Referencia administrativa'),
    ],
  },
  {
    numero: 7,
    nombre: 'Evaluación de desempeño y progresión',
    carpeta: '07_Evaluacion_y_Progresion',
    descripcion: 'Documentación sobre resultados de evaluación, promoción o progresión que corresponda al régimen aplicable.',
    campos: [
      texto('periodo', 'Período evaluado'),
      texto('cargoEvaluado', 'Cargo evaluado'),
      texto('resultado', 'Resultado o calificación'),
      texto('areaEvaluadora', 'Área evaluadora'),
    ],
  },
  {
    numero: 8,
    nombre: 'Reconocimientos y sanciones',
    carpeta: '08_Reconocimientos_y_Sanciones',
    descripcion:
      'Resoluciones de reconocimiento, felicitaciones y sanciones, conservando trazabilidad y restricciones cuando correspondan.',
    campos: [
      seleccion('categoria', 'Categoría', ['Reconocimiento', 'Sanción', 'Actuación disciplinaria']),
      texto('autoridad', 'Autoridad emisora'),
      fecha('fechaEfecto', 'Fecha de efecto'),
    ],
  },
  {
    numero: 9,
    nombre: 'Relaciones laborales individuales y colectivas',
    carpeta: '09_Relaciones_Laborales',
    descripcion: 'Documentos laborales individuales y colectivos que no correspondan a vacaciones o licencias de la sección 13.',
    campos: [
      texto('materia', 'Materia o asunto laboral'),
      texto('instancia', 'Área o instancia participante'),
      fecha('fechaReunion', 'Fecha de reunión, si aplica'),
      texto('expediente', 'Número de expediente, si aplica'),
    ],
  },
  {
    numero: 10,
    nombre: 'Seguridad, salud en el trabajo y bienestar',
    carpeta: '10_SST_y_Bienestar',
    descripcion: 'Archivos administrativos de SST y bienestar. No almacenar historias clínicas ni diagnósticos en campos abiertos.',
    campos: [
      seleccion('categoria', 'Categoría SST', ['Capacitación', 'Aptitud ocupacional', 'Prevención', 'Bienestar', 'EPP', 'Otro']),
      texto('areaResponsable', 'Área responsable'),
    ],
  },
  {
    numero: 11,
    nombre: 'Desvinculación',
    carpeta: '11_Desvinculacion',
    descripcion:
      'Registro documental de renuncias, jubilaciones, fallecimientos, vencimientos y otros ceses. El cambio de estado laboral se valida por separado.',
    campos: [
      seleccion('motivoCese', 'Motivo de cese', MOTIVOS_CESE),
      fecha('fechaCese', 'Fecha efectiva de cese'),
      texto('sustento', 'Documento de sustento o referencia'),
      texto('areaTramite', 'Área que tramita'),
    ],
  },
  {
    numero: 12,
    nombre: 'Otros documentos',
    carpeta: '12_Otros',
    descripcion:
      'Archivos que no encajen en otra sección. Se debe justificar su clasificación para evitar que esta sección se convierta en un depósito desordenado.',
    campos: [
      texto('categoria', 'Categoría propuesta'),
      { clave: 'justificacion', etiqueta: '¿Por qué corresponde a Otros?', tipo: 'parrafo', obligatorio: true },
      texto('oficinaEmisora', 'Oficina emisora'),
    ],
  },
  {
    numero: 13,
    nombre: 'Vacaciones, licencias y permisos',
    carpeta: '13_Vacaciones_Licencias_y_Permisos',
    descripcion: 'Solicitudes, resoluciones y autorizaciones de vacaciones, licencias y permisos; no se mezclan con la sección 09.',
    campos: [
      seleccion('clase', 'Clase de ausencia', ['Vacaciones', 'Licencia', 'Permiso']),
      fecha('inicio', 'Fecha de inicio'),
      fecha('fin', 'Fecha de término'),
      { clave: 'dias', etiqueta: 'Días autorizados, si aplica', tipo: 'numero', obligatorio: false },
      texto('areaAutoriza', 'Área que autoriza'),
    ],
  },
];

const CAMPOS_VINCULO: CampoSeccion[] = [
  seleccion('tipoIncorporacion', 'Tipo de incorporación', TIPOS_INCORPORACION),
  catalogo('regimen', 'Régimen o modalidad', 'regimen'),
  fecha('inicio', 'Inicio del vínculo'),
  fecha('fin', 'Fin del vínculo, si aplica'),
  catalogo('dependencia', 'Área o dependencia', 'area'),
  catalogo('puesto', 'Cargo o puesto objeto del contrato', 'cargo'),
];
const CAMPOS_CV: CampoSeccion[] = [
  seleccion('tipoCv', 'Tipo de currículum', ['Simple', 'Documentado']),
  fecha('fechaCv', 'Fecha de actualización del CV'),
  texto('perfilCv', 'Perfil o especialidad, si consta'),
];
const CAMPOS_DECLARACION: CampoSeccion[] = [
  texto('finalidad', 'Finalidad de la declaración jurada'),
  fecha('fechaSuscripcion', 'Fecha de suscripción'),
  texto('proceso', 'Concurso o convocatoria de referencia'),
];
const CAMPOS_CONCURSO: CampoSeccion[] = [
  texto('concurso', 'Concurso o convocatoria'),
  texto('plaza', 'Plaza o cargo al que postuló'),
  texto('resultadoConcurso', 'Resultado, puntaje o referencia, si corresponde'),
];
const CAMPOS_CONSULTA: CampoSeccion[] = [
  texto('entidadConsulta', 'Entidad o plataforma emisora'),
  fecha('fechaConsulta', 'Fecha de emisión o consulta'),
];
const CAMPOS_PENSION: CampoSeccion[] = [
  seleccion('sistemaPensionario', 'Sistema pensionario', ['SNP / ONP', 'SPP / AFP', 'Otro']),
  fecha('fechaEleccion', 'Fecha de elección'),
];
const CAMPOS_TRAMITE: CampoSeccion[] = [texto('procedimiento', 'Proceso o trámite relacionado')];
const CAMPOS_GRADO: CampoSeccion[] = [
  texto('gradoAcreditado', 'Grado o título acreditado'),
  texto('registroSunedu', 'Registro o código SUNEDU, si corresponde'),
  fecha('fechaGrado', 'Fecha de grado o título'),
];
const CAMPOS_CURSO: CampoSeccion[] = [
  texto('horasAcademicas', 'Horas académicas, si constan'),
  texto('modalidadEstudio', 'Modalidad o especialidad'),
];
const CAMPOS_SERVICIO: CampoSeccion[] = [
  texto('ordenReferencia', 'N.º de orden de servicio o referencia'),
  texto('objetoServicio', 'Objeto o descripción del servicio'),
];
const CAMPOS_EXPERIENCIA: CampoSeccion[] = [texto('referenciaLaboral', 'Documento o contrato relacionado')];
const CAMPOS_COMPENSACION: CampoSeccion[] = [
  texto('actoSustento', 'Acto administrativo de sustento'),
  texto('montoReferencial', 'Monto o referencia, solo si consta'),
];
const CAMPOS_EVALUACION: CampoSeccion[] = [texto('procesoEvaluado', 'Proceso de evaluación o progresión')];
const CAMPOS_RESOLUTIVO: CampoSeccion[] = [texto('actoResolutivo', 'Acto o número de resolución')];
const CAMPOS_SST: CampoSeccion[] = [texto('documentoSst', 'Código o referencia SST')];
const CAMPOS_OTROS: CampoSeccion[] = [texto('referenciaOrigen', 'Documento o expediente relacionado')];
const CAMPOS_AUSENCIA: CampoSeccion[] = [
  texto('actoAutorizacion', 'Documento de autorización'),
  fecha('fechaEfecto', 'Fecha de efecto'),
];

export interface TipoSemilla {
  codigo: string;
  nombre: string;
  restringido: boolean;
  requiereNumero: boolean;
  tieneVencimiento: boolean;
  accion: AccionTipo;
  campos: CampoSeccion[];
}

type Opciones = Partial<Pick<TipoSemilla, 'restringido' | 'requiereNumero' | 'tieneVencimiento' | 'accion'>>;

const tipo = (codigo: string, nombre: string, campos: CampoSeccion[] = [], opciones: Opciones = {}): TipoSemilla => ({
  codigo,
  nombre,
  restringido: opciones.restringido ?? false,
  requiereNumero: opciones.requiereNumero ?? false,
  tieneVencimiento: opciones.tieneVencimiento ?? false,
  accion: opciones.accion ?? 'NINGUNA',
  campos,
});

const contrato = { requiereNumero: true, accion: 'VINCULO' } as const;
const movimiento = { accion: 'MOVIMIENTO' } as const;
const cese = { accion: 'CESE' } as const;

export const TIPOS_DOCUMENTO: readonly TipoSemilla[] = [
  tipo('0101', 'Copia de DNI ampliado', [], { tieneVencimiento: true }),
  tipo('0102', 'Ficha INFORHUS'),
  tipo('0105', 'Declaración jurada de datos personales'),
  tipo('0106', 'Autorización de notificación vía correo electrónico (actualización de contacto)'),

  tipo('0201', 'Currículum vitae', CAMPOS_CV),
  tipo('0202', 'Contrato CAS', CAMPOS_VINCULO, contrato),
  tipo('0203', 'Contrato administrativo', CAMPOS_VINCULO, contrato),
  tipo('0204', 'Contrato de locación de servicios', CAMPOS_VINCULO, contrato),
  tipo('0205', 'Adenda contractual', CAMPOS_VINCULO, contrato),
  tipo('0207', 'Resolución de nombramiento', CAMPOS_VINCULO, contrato),
  tipo('0210', 'Declaración jurada de ingreso', CAMPOS_DECLARACION),
  tipo('0299', 'Otro documento de incorporación', CAMPOS_TRAMITE),
  tipo('0213', 'Solicitud de postulación a concurso público', CAMPOS_CONCURSO),
  tipo('0214', 'Ficha de postulante', CAMPOS_CONCURSO),
  tipo('0215', 'Currículum Vitae (CV) documentado', CAMPOS_CV),
  tipo('0216', 'Ficha de evaluación curricular', CAMPOS_CONCURSO),
  tipo('0217', 'Resultado de evaluación de conocimientos (examen)', CAMPOS_CONCURSO),
  tipo('0218', 'Ficha de evaluación de entrevista personal', CAMPOS_CONCURSO),
  tipo('0219', 'Cuadro de méritos del concurso público', CAMPOS_CONCURSO),
  tipo('0220', 'Resultados finales del concurso público', CAMPOS_CONCURSO),
  tipo('0221', 'Memorando de resultados del concurso público', CAMPOS_CONCURSO),
  tipo('0212', 'Acta de adjudicación de plaza', CAMPOS_CONCURSO),
  tipo('0223', 'Declaración jurada de veracidad de documentos', CAMPOS_DECLARACION),
  tipo('0224', 'Declaración jurada de compromiso', CAMPOS_DECLARACION),
  tipo('0225', 'Declaración jurada de gozar buena salud', CAMPOS_DECLARACION),
  tipo('0226', 'Declaración jurada de conocimiento del Código de Ética de la Función Pública', CAMPOS_DECLARACION),
  tipo('0227', 'Declaración jurada de antecedentes policiales, penales y judiciales', CAMPOS_DECLARACION),
  tipo('0228', 'Declaración jurada para prevenir casos de nepotismo', CAMPOS_DECLARACION),
  tipo('0229', 'Declaración jurada de ausencia de incompatibilidades', CAMPOS_DECLARACION),
  tipo('0230', 'Declaración jurada de no tener impedimentos para contratar', CAMPOS_DECLARACION),
  tipo('0231', 'Constancia de consulta REDAM', CAMPOS_CONSULTA, { tieneVencimiento: true }),
  tipo('0232', 'Constancia de consulta RNSSC', CAMPOS_CONSULTA, { tieneVencimiento: true }),
  tipo('0233', 'Certificado Único Laboral (CUL)', CAMPOS_CONSULTA, { tieneVencimiento: true }),
  tipo('0234', 'Formato de elección del régimen pensionario', CAMPOS_PENSION),
  tipo('0235', 'Autorización de notificación vía correo electrónico', CAMPOS_TRAMITE),
  tipo('0236', 'Copia de resultados de concurso', CAMPOS_CONCURSO),
  tipo('0237', 'Fe de erratas de documento de incorporación', CAMPOS_TRAMITE),

  tipo('0303', 'Grado académico', CAMPOS_GRADO),
  tipo('0302', 'Título profesional', CAMPOS_GRADO),
  tipo('0304', 'Título técnico', CAMPOS_GRADO),
  tipo('0311', 'Certificado de curso', CAMPOS_CURSO),
  tipo('0312', 'Diplomado', CAMPOS_CURSO),
  tipo('0315', 'Constancia de capacitación', CAMPOS_CURSO),
  tipo('0306', 'Constancia de colegiatura', [], { requiereNumero: true }),
  tipo('0307', 'Habilitación profesional', [], { tieneVencimiento: true }),
  tipo('0316', 'Resolución SERUMS', [], { requiereNumero: true }),
  tipo('0317', 'Grado de Bachiller', CAMPOS_GRADO),
  tipo('0318', 'Diploma de grado de Bachiller', CAMPOS_GRADO),
  tipo('0301', 'Constancia de inscripción de grados y títulos – SUNEDU', CAMPOS_GRADO),
  tipo('0320', 'Diploma de diplomado', CAMPOS_CURSO),
  tipo('0321', 'Constancia de habilidad profesional', [], { tieneVencimiento: true }),
  tipo('0322', 'Certificado de estudios', CAMPOS_CURSO),
  tipo('0310', 'Certificado de capacitación', CAMPOS_CURSO),
  tipo('0324', 'Certificado de diplomado', CAMPOS_CURSO),

  tipo('0401', 'Constancia de trabajo', CAMPOS_EXPERIENCIA),
  tipo('0402', 'Certificado de trabajo', CAMPOS_EXPERIENCIA),
  tipo('0403', 'Resolución que acredita servicios', CAMPOS_EXPERIENCIA, { requiereNumero: true }),
  tipo('0404', 'Constancia de prácticas', CAMPOS_EXPERIENCIA),
  tipo('0405', 'Documento de servicios prestados', CAMPOS_EXPERIENCIA),
  tipo('0499', 'Otro documento de experiencia', CAMPOS_EXPERIENCIA),
  tipo('0406', 'Orden de Servicio', CAMPOS_SERVICIO),
  tipo('0407', 'Conformidad de Servicio', CAMPOS_SERVICIO),
  tipo('0408', 'Constancia de prestación de servicios', CAMPOS_SERVICIO),
  tipo('0409', 'Contrato de locación de servicios (experiencia previa)', CAMPOS_SERVICIO),
  tipo('0410', 'Recibo por honorarios (sustento complementario)', CAMPOS_SERVICIO),
  tipo('0411', 'Certificado de prácticas preprofesionales', CAMPOS_EXPERIENCIA),

  tipo('0509', 'Resolución de rotación', [], movimiento),
  tipo('0501', 'Memorando de rotación', [], movimiento),
  tipo('0504', 'Resolución de destaque', [], movimiento),
  tipo('0505', 'Resolución de reasignación', [], movimiento),
  tipo('0502', 'Documento de encargatura', [], movimiento),
  tipo('0506', 'Resolución de designación', [], movimiento),
  tipo('0503', 'Cambio de funciones', [], movimiento),

  tipo('0603', 'Resolución de asignación', CAMPOS_COMPENSACION),
  tipo('0604', 'Resolución de beneficio', CAMPOS_COMPENSACION),
  tipo('0607', 'Reconocimiento de beneficio', CAMPOS_COMPENSACION),
  tipo('0605', 'Informe de compensaciones', CAMPOS_COMPENSACION),
  tipo('0606', 'Constancia de pago', CAMPOS_COMPENSACION),
  tipo('0699', 'Otro documento de compensación', CAMPOS_COMPENSACION),

  tipo('0701', 'Evaluación de desempeño', CAMPOS_EVALUACION),
  tipo('0702', 'Informe de desempeño', CAMPOS_EVALUACION),
  tipo('0704', 'Resolución de progresión', CAMPOS_EVALUACION, { requiereNumero: true }),
  tipo('0707', 'Resolución de ascenso', CAMPOS_EVALUACION, { requiereNumero: true }),
  tipo('0706', 'Informe de cumplimiento de metas', CAMPOS_EVALUACION),
  tipo('0799', 'Otro documento de evaluación', CAMPOS_EVALUACION),

  tipo('0802', 'Resolución de felicitación', CAMPOS_RESOLUTIVO),
  tipo('0809', 'Carta de reconocimiento', CAMPOS_RESOLUTIVO),
  tipo('0803', 'Memorando de felicitación', CAMPOS_RESOLUTIVO),
  tipo('0806', 'Resolución de sanción', CAMPOS_RESOLUTIVO, { restringido: true, requiereNumero: true }),
  tipo('0805', 'Memorando disciplinario', CAMPOS_RESOLUTIVO, { restringido: true, requiereNumero: true }),
  tipo('0807', 'Documento de procedimiento disciplinario', CAMPOS_RESOLUTIVO, { restringido: true }),

  tipo('0905', 'Acta de reunión laboral'),
  tipo('0903', 'Acuerdo individual'),
  tipo('0906', 'Convenio colectivo'),
  tipo('0901', 'Comunicación laboral'),
  tipo('0902', 'Solicitud laboral'),
  tipo('0907', 'Resolución sobre relación laboral', [], { requiereNumero: true }),
  tipo('0999', 'Otro documento laboral'),

  tipo('1005', 'Constancia de inducción SST', CAMPOS_SST),
  tipo('1006', 'Constancia de capacitación SST', CAMPOS_SST),
  tipo('1002', 'Aptitud ocupacional administrativa', CAMPOS_SST, { restringido: true, tieneVencimiento: true }),
  tipo('1007', 'Acta de entrega EPP', CAMPOS_SST),
  tipo('1008', 'Registro de capacitación preventiva', CAMPOS_SST),
  tipo('1003', 'Documento de bienestar', CAMPOS_SST),
  tipo('1099', 'Otro documento SST', CAMPOS_SST),

  tipo('1101', 'Carta de renuncia', [], cese),
  tipo('1102', 'Resolución de cese', [], { ...cese, requiereNumero: true }),
  tipo('1107', 'Resolución de jubilación', [], { ...cese, requiereNumero: true }),
  tipo('1108', 'Documento de fallecimiento (sustento autorizado)', [], { ...cese, restringido: true }),
  tipo('1104', 'Constancia de trabajo por cese'),
  tipo('1106', 'Acta de entrega de cargo'),
  tipo('1103', 'Documento de término de contrato', [], cese),
  tipo('1109', 'Carta de comunicación de término de contrato', [], cese),
  tipo('1110', 'Fe de erratas de resolución de cese'),

  tipo('1204', 'Informe complementario', CAMPOS_OTROS),
  tipo('1201', 'Comunicación administrativa', CAMPOS_OTROS),
  tipo('1202', 'Documento de archivo', CAMPOS_OTROS),
  tipo('1203', 'Anexo complementario', CAMPOS_OTROS),
  tipo('1299', 'Otro documento', CAMPOS_OTROS),

  tipo('1302', 'Solicitud de vacaciones', CAMPOS_AUSENCIA),
  tipo('1301', 'Resolución de vacaciones', CAMPOS_AUSENCIA, { requiereNumero: true }),
  tipo('1308', 'Solicitud de licencia', CAMPOS_AUSENCIA),
  tipo('1309', 'Resolución de licencia', CAMPOS_AUSENCIA, { requiereNumero: true }),
  tipo('1310', 'Solicitud de permiso', CAMPOS_AUSENCIA),
  tipo('1306', 'Autorización de permiso', CAMPOS_AUSENCIA),
  tipo('1311', 'Documento de reincorporación', CAMPOS_AUSENCIA),
];

export const REGIMENES: ReadonlyArray<{ codigo: string; nombre: string; esLaboral: boolean }> = [
  { codigo: 'DL1057', nombre: 'D. Leg. 1057 (CAS)', esLaboral: true },
  { codigo: 'DL276', nombre: 'D. Leg. 276', esLaboral: true },
  { codigo: 'DL728', nombre: 'D. Leg. 728', esLaboral: true },
  { codigo: 'L30057', nombre: 'Ley 30057 (Servicio Civil)', esLaboral: true },
  { codigo: 'LOCACION', nombre: 'Locación de servicios', esLaboral: false },
  { codigo: 'OTRO', nombre: 'Otro', esLaboral: true },
];

export const SECCIONES_RESTRINGIDAS_POR_ROL: Readonly<Record<string, readonly number[]>> = {
  Operador: [8, 10],
  Consulta: [8, 10],
};

export interface RequisitoSemilla {
  tipo: string;
  regimen: string | null;
  tipoPersonal: 'ADMINISTRATIVO' | 'ASISTENCIAL' | null;
  aplicaA: 'ACTIVO' | 'CESADO' | 'TODOS';
}

export const REQUISITOS: readonly RequisitoSemilla[] = [
  { tipo: '0101', regimen: null, tipoPersonal: null, aplicaA: 'TODOS' },
  { tipo: '0102', regimen: null, tipoPersonal: null, aplicaA: 'TODOS' },
  { tipo: '0105', regimen: null, tipoPersonal: null, aplicaA: 'TODOS' },
  { tipo: '0201', regimen: null, tipoPersonal: null, aplicaA: 'TODOS' },
  { tipo: '0202', regimen: 'DL1057', tipoPersonal: null, aplicaA: 'TODOS' },
  { tipo: '0204', regimen: 'LOCACION', tipoPersonal: null, aplicaA: 'TODOS' },
  { tipo: '0207', regimen: 'DL276', tipoPersonal: null, aplicaA: 'TODOS' },
  { tipo: '0302', regimen: null, tipoPersonal: 'ASISTENCIAL', aplicaA: 'TODOS' },
  { tipo: '1102', regimen: 'DL276', tipoPersonal: null, aplicaA: 'CESADO' },
  { tipo: '1103', regimen: 'DL1057', tipoPersonal: null, aplicaA: 'CESADO' },
];
