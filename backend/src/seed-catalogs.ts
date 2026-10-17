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
    descripcion: 'Datos personales y familiares del servidor civil, documentos de identidad, antecedentes y declaraciones juradas.',
    campos: [],
  },
  {
    numero: 2,
    nombre: 'Incorporación',
    carpeta: '02_Incorporacion',
    descripcion: 'Selección, vínculo e inducción: resultados del proceso de selección, resoluciones, contratos, adendas e inducción.',
    campos: [],
  },
  {
    numero: 3,
    nombre: 'Formación académica y capacitación',
    carpeta: '03_Formacion_Academica_y_Capacitacion',
    descripcion: 'Grados y capacitaciones: estudios, títulos, colegiatura, postgrados y cursos.',
    campos: [
      texto('institucion', 'Institución formadora / emisora'),
      texto('programa', 'Carrera, especialidad o curso'),
      fecha('fechaCulminacion', 'Fecha de culminación (si aplica)'),
      texto('colegioProfesional', 'Colegio profesional (si aplica)'),
      texto('numeroColegiatura', 'Número de colegiatura (si aplica)'),
    ],
  },
  {
    numero: 4,
    nombre: 'Experiencia laboral',
    carpeta: '04_Experiencia_Laboral',
    descripcion: 'Experiencia acreditada: certificados, constancias y documentos que acreditan tiempo de servicio y funciones.',
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
    descripcion: 'Vacaciones, licencias y permisos.',
    campos: [
      seleccion('categoria', 'Categoría documental', ['Vacaciones', 'Licencia', 'Permiso', 'Otro']),
      fecha('inicio', 'Fecha de inicio (si corresponde)'),
      fecha('fin', 'Fecha de término (si corresponde)'),
    ],
  },
  {
    numero: 6,
    nombre: 'Compensaciones',
    carpeta: '06_Compensaciones',
    descripcion: 'Reconocimiento de tiempo de servicios, compensaciones económicas y no económicas, retenciones y liquidaciones.',
    campos: [
      texto('concepto', 'Concepto del beneficio'),
      texto('periodo', 'Período de referencia'),
      fecha('fechaEfecto', 'Fecha de efecto'),
      texto('referencia', 'Referencia administrativa'),
    ],
  },
  {
    numero: 7,
    nombre: 'Evaluación de desempeño, progresión en la carrera y desplazamiento',
    carpeta: '07_Desempeno_Carrera_y_Desplazamiento',
    descripcion: 'Desempeño, carrera y desplazamiento: gestión del rendimiento, progresión, designación, rotación, destaque y encargo.',
    campos: [
      texto('periodo', 'Período evaluado'),
      texto('cargoEvaluado', 'Cargo evaluado'),
      texto('resultado', 'Resultado o calificación (opcional)'),
      texto('areaEvaluadora', 'Área evaluadora'),
    ],
  },
  {
    numero: 8,
    nombre: 'Reconocimientos y sanciones disciplinarias',
    carpeta: '08_Reconocimientos_y_Sanciones',
    descripcion: 'Reconocimientos, felicitaciones, sanciones y recursos impugnatorios.',
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
    descripcion: 'Controversias y sindicalización: controversias individuales y colectivas y afiliación sindical.',
    campos: [
      texto('materia', 'Materia o asunto laboral'),
      texto('instancia', 'Área o instancia participante'),
      fecha('fechaReunion', 'Fecha de reunión (si aplica)'),
      texto('expediente', 'Número de expediente (si aplica)'),
    ],
  },
  {
    numero: 10,
    nombre: 'Seguridad y Salud en el Trabajo (SST) y bienestar social',
    carpeta: '10_SST_y_Bienestar_Social',
    descripcion: 'SST y bienestar social: reglamento SST, simulacros, capacitaciones, seguros, subsidios, descansos médicos y EPS.',
    campos: [
      seleccion('categoria', 'Categoría SST', ['Capacitación', 'Aptitud ocupacional', 'Prevención', 'Bienestar', 'EPP', 'Otro']),
      texto('areaResponsable', 'Área responsable'),
    ],
  },
  {
    numero: 11,
    nombre: 'Desvinculación',
    carpeta: '11_Desvinculacion',
    descripcion: 'Documentos de desvinculación: término del vínculo, entrega de cargo, informe de gestión y liquidación.',
    campos: [
      seleccion('motivoCese', 'Motivo de cese', MOTIVOS_CESE),
      fecha('fechaCese', 'Fecha efectiva de cese'),
      texto('sustento', 'Documento de sustento / referencia'),
      texto('areaTramite', 'Área que tramita'),
    ],
  },
  {
    numero: 12,
    nombre: 'Otros que considere la entidad',
    carpeta: '12_Otros_que_Considere_la_Entidad',
    descripcion: 'Complementarios del legajo: documentos que no corresponden a ninguna de las otras 11 secciones.',
    campos: [
      texto('categoria', 'Categoría propuesta'),
      { clave: 'justificacion', etiqueta: '¿Por qué corresponde a Otros?', tipo: 'parrafo', obligatorio: true },
      texto('oficinaEmisora', 'Oficina emisora'),
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
const vigencia = (): CampoSeccion => fecha('vigenciaHasta', 'Vigencia hasta (si corresponde)');

const CAMPOS_CONTRATO: CampoSeccion[] = [
  ...CAMPOS_VINCULO,
  fecha('vigenciaDesde', 'Vigencia desde'),
  fecha('vigenciaHasta', 'Vigencia hasta'),
];
const CAMPOS_CONCURSO: CampoSeccion[] = [
  texto('concurso', 'Concurso / convocatoria'),
  texto('plaza', 'Plaza o cargo al que postuló'),
  texto('resultadoConcurso', 'Resultado, puntaje o referencia (si corresponde)'),
];
const CAMPOS_TRAMITE: CampoSeccion[] = [texto('procedimiento', 'Proceso o trámite relacionado (opcional)')];
const CAMPOS_RESOLUCION_VINCULO: CampoSeccion[] = [...CAMPOS_VINCULO, ...CAMPOS_TRAMITE];
const CAMPOS_GRADO: CampoSeccion[] = [
  texto('gradoAcreditado', 'Grado o título acreditado'),
  texto('registroSunedu', 'Registro / código SUNEDU (si corresponde)'),
  fecha('fechaGrado', 'Fecha de grado / título'),
];
const CAMPOS_COLEGIATURA: CampoSeccion[] = [
  texto('colegioHabilitacion', 'Colegio profesional'),
  texto('numeroHabilitacion', 'Número de colegiatura'),
  vigencia(),
];
const CAMPOS_CURSO: CampoSeccion[] = [
  texto('horasAcademicas', 'Horas académicas (si constan)'),
  texto('modalidadEstudio', 'Modalidad / especialidad'),
  vigencia(),
];
const CAMPOS_EXPERIENCIA: CampoSeccion[] = [texto('referenciaLaboral', 'Documento / contrato relacionado (opcional)')];
const CAMPOS_AUSENCIA: CampoSeccion[] = [texto('sustentoAusencia', 'Documento que autoriza la ausencia')];
const CAMPOS_COMPENSACION: CampoSeccion[] = [
  texto('actoSustento', 'Acto administrativo de sustento'),
  texto('montoReferencial', 'Monto o referencia (solo si consta)'),
];
const CAMPOS_EVALUACION: CampoSeccion[] = [
  texto('procesoEvaluado', 'Proceso de evaluación / progresión'),
  texto('resultadoDocumento', 'Resultado consignado'),
];
const CAMPOS_DESPLAZAMIENTO: CampoSeccion[] = [
  ...CAMPOS_EVALUACION,
  seleccion('tipoMovimiento', 'Tipo de movimiento', TIPOS_MOVIMIENTO),
  catalogo('areaOrigen', 'Área de origen', 'area'),
  catalogo('areaDestino', 'Área de destino', 'area'),
  fecha('fechaEfecto', 'Fecha efectiva del movimiento'),
];
const CAMPOS_RESOLUTIVO: CampoSeccion[] = [
  texto('actoResolutivo', 'Acto o número de resolución'),
  fecha('fechaEfectiva', 'Fecha efectiva (si corresponde)'),
];
const CAMPOS_RELACION_LABORAL: CampoSeccion[] = [
  texto('asuntoDocumento', 'Asunto o materia'),
  texto('expedienteReferencia', 'Expediente o referencia asociada'),
];
const CAMPOS_SST: CampoSeccion[] = [texto('documentoSst', 'Código / referencia SST'), vigencia()];
const CAMPOS_OTROS: CampoSeccion[] = [texto('referenciaOrigen', 'Documento o expediente relacionado')];

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

const restringido = { restringido: true } as const;

export const CODIGO_FICHA_TEXTO = '0101';

export const TIPOS_DOCUMENTO: readonly TipoSemilla[] = [
  tipo(CODIGO_FICHA_TEXTO, 'Ficha de datos del servidor civil (SOLO TEXTO)'),
  tipo('0102', 'Copia del DNI o documento equivalente', [], { tieneVencimiento: true }),
  tipo('0103', 'Declaración jurada o certificado de antecedentes penales'),
  tipo('0104', 'Declaración jurada o certificado de antecedentes policiales'),
  tipo('0105', 'Declaración jurada de bienes y rentas, cuando corresponda'),
  tipo('0106', 'Declaración jurada de no tener impedimentos para designación, según Ley N.º 31419'),
  tipo('0107', 'Partida de matrimonio o constancia de unión de hecho'),
  tipo('0108', 'Información de impedimentos e inhabilitaciones (RNSSC, REDJUM, entre otros)'),
  tipo('0109', 'Copia del DNI del cónyuge o conviviente'),
  tipo('0110', 'Copia del DNI de los hijos menores de edad'),
  tipo('0111', 'Certificado de discapacidad emitido por CONADIS, cuando corresponda'),
  tipo('0112', 'Otras declaraciones juradas que correspondan'),

  tipo('0201', 'Resultado final del proceso de selección donde el servidor resultó ganador', CAMPOS_CONCURSO),
  tipo(
    '0202',
    'Informe de Recursos Humanos que verifica el cumplimiento de los requisitos del puesto, cuando corresponda',
    CAMPOS_TRAMITE,
  ),
  tipo('0203', 'Resolución administrativa de designación', CAMPOS_RESOLUCION_VINCULO, contrato),
  tipo('0204', 'Resolución administrativa de renovación', CAMPOS_RESOLUCION_VINCULO, contrato),
  tipo('0205', 'Resolución administrativa del servicio civil de carrera', CAMPOS_RESOLUCION_VINCULO, contrato),
  tipo('0206', 'Contrato', CAMPOS_CONTRATO, contrato),
  tipo('0207', 'Adenda', CAMPOS_CONTRATO, contrato),
  tipo('0208', 'Registro de inducción general y específica', CAMPOS_TRAMITE),
  tipo('0209', 'Cargo de entrega del perfil del puesto y funciones', CAMPOS_TRAMITE),
  tipo('0210', 'Cargo de entrega del reglamento interno de servidores civiles', CAMPOS_TRAMITE),
  tipo('0211', 'Cargo de entrega del código de conducta y ética', CAMPOS_TRAMITE),
  tipo('0212', 'Otros documentos similares', CAMPOS_TRAMITE),
  tipo('0213', 'Evaluación y resultados del período de prueba', CAMPOS_CONCURSO),

  tipo('0301', 'Certificado oficial de estudios básicos, cuando corresponda', CAMPOS_CURSO),
  tipo('0302', 'Títulos o grados de estudios superiores técnicos o universitarios', CAMPOS_GRADO),
  tipo('0303', 'Colegiatura y habilitación profesional', CAMPOS_COLEGIATURA, { tieneVencimiento: true }),
  tipo('0304', 'Certificados o diplomas de postgrado (diplomados o programas de especialización)', CAMPOS_GRADO),
  tipo('0305', 'Diploma de grado académico de Maestría o Doctorado', CAMPOS_GRADO),
  tipo('0306', 'Certificados, constancias o diplomas de cursos y programas de capacitación', CAMPOS_CURSO),
  tipo(
    '0307',
    'Constancias de participación en congresos, convenciones, seminarios, talleres, fórums, simposios, conferencias, charlas y similares',
  ),
  tipo('0308', 'Otros documentos relacionados con la formación académica y capacitación', CAMPOS_CURSO),

  tipo('0401', 'Certificados de trabajo', CAMPOS_EXPERIENCIA),
  tipo('0402', 'Constancias de trabajo', CAMPOS_EXPERIENCIA),
  tipo('0403', 'Otros documentos que acrediten el tiempo de servicio', CAMPOS_EXPERIENCIA),
  tipo('0404', 'Resoluciones que acrediten funciones desempeñadas', CAMPOS_EXPERIENCIA),
  tipo('0405', 'Memorandos que acrediten asignación de funciones', CAMPOS_EXPERIENCIA),
  tipo('0406', 'Otros documentos que acrediten funciones desempeñadas', CAMPOS_EXPERIENCIA),

  tipo('0501', 'Documento que aprueba una licencia o permiso', CAMPOS_AUSENCIA),
  tipo('0502', 'Documento que sustenta el goce vacacional', CAMPOS_AUSENCIA),
  tipo('0503', 'Documento de adelanto de vacaciones', CAMPOS_AUSENCIA),
  tipo('0504', 'Documento de postergación de vacaciones', CAMPOS_AUSENCIA),
  tipo('0505', 'Rol de vacaciones', CAMPOS_AUSENCIA),
  tipo('0506', 'Licencia por maternidad', CAMPOS_AUSENCIA),
  tipo('0507', 'Licencia por paternidad', CAMPOS_AUSENCIA),
  tipo('0508', 'Licencia por lactancia', CAMPOS_AUSENCIA),
  tipo('0509', 'Licencia por adopción', CAMPOS_AUSENCIA),
  tipo('0510', 'Licencia sindical', CAMPOS_AUSENCIA),
  tipo('0511', 'Licencia por enfermedad de familiar grave', CAMPOS_AUSENCIA),
  tipo('0512', 'Licencia por participación en comité SST', CAMPOS_AUSENCIA),
  tipo('0513', 'Licencia por asistencia médica a un familiar', CAMPOS_AUSENCIA),
  tipo('0514', 'Licencia por servicio como bombero voluntario', CAMPOS_AUSENCIA),
  tipo('0515', 'Otras licencias otorgadas', CAMPOS_AUSENCIA),

  tipo('0601', 'Documento de reconocimiento de tiempo de servicios', CAMPOS_COMPENSACION),
  tipo('0602', 'Documentación referente al pago de compensaciones económicas', CAMPOS_COMPENSACION),
  tipo('0603', 'Documentación referente a compensaciones no económicas', CAMPOS_COMPENSACION),
  tipo('0604', 'Certificado de retención de quinta categoría', CAMPOS_COMPENSACION),
  tipo('0605', 'Certificado de retención de cuarta categoría', CAMPOS_COMPENSACION),
  tipo('0606', 'Otros certificados de retención, cuando corresponda', CAMPOS_COMPENSACION),
  tipo('0607', 'Liquidación de beneficios sociales', CAMPOS_COMPENSACION),

  tipo('0701', 'Formato para la gestión del rendimiento', CAMPOS_EVALUACION),
  tipo('0702', 'Registro de evidencias de evaluación', CAMPOS_EVALUACION),
  tipo('0703', 'Formato de reunión de seguimiento', CAMPOS_EVALUACION),
  tipo('0704', 'Notificación de evaluación obtenida', CAMPOS_EVALUACION),
  tipo('0705', 'Acta de retroalimentación de resultados', CAMPOS_EVALUACION),
  tipo('0706', 'Plan de mejora del desempeño', CAMPOS_EVALUACION),
  tipo('0707', 'Resolución de progresión en la carrera', CAMPOS_EVALUACION),
  tipo('0708', 'Documento de designación', CAMPOS_DESPLAZAMIENTO, movimiento),
  tipo('0709', 'Documento de rotación', CAMPOS_DESPLAZAMIENTO, movimiento),
  tipo('0710', 'Documento de destaque', CAMPOS_DESPLAZAMIENTO, movimiento),
  tipo('0711', 'Documento de encargo de puestos o funciones', CAMPOS_DESPLAZAMIENTO, movimiento),
  tipo('0712', 'Otros documentos de desplazamiento', CAMPOS_DESPLAZAMIENTO, movimiento),

  tipo('0801', 'Carta de felicitación', CAMPOS_RESOLUTIVO, restringido),
  tipo('0802', 'Oficio de felicitación', CAMPOS_RESOLUTIVO, restringido),
  tipo('0803', 'Memorando de felicitación', CAMPOS_RESOLUTIVO, restringido),
  tipo('0804', 'Condecoración', CAMPOS_RESOLUTIVO, restringido),
  tipo('0805', 'Diploma por reconocimiento de participación excepcional en proyectos o eventos', CAMPOS_RESOLUTIVO, restringido),
  tipo('0806', 'Certificado o constancia de reconocimiento excepcional por labor docente', CAMPOS_RESOLUTIVO, restringido),
  tipo('0807', 'Certificado o constancia de reconocimiento por tiempo de servicios', CAMPOS_RESOLUTIVO, restringido),
  tipo('0808', 'Documento de amonestación escrita', CAMPOS_RESOLUTIVO, restringido),
  tipo('0809', 'Documento de suspensión', CAMPOS_RESOLUTIVO, restringido),
  tipo('0810', 'Documento de destitución', CAMPOS_RESOLUTIVO, restringido),
  tipo('0811', 'Documento que declara fundado un recurso impugnatorio', CAMPOS_RESOLUTIVO, restringido),
  tipo('0812', 'Documento que declara infundado un recurso impugnatorio', CAMPOS_RESOLUTIVO, restringido),
  tipo('0813', 'Documento que declara improcedente un recurso impugnatorio', CAMPOS_RESOLUTIVO, restringido),

  tipo('0901', 'Documentación relacionada con controversias individuales', CAMPOS_RELACION_LABORAL),
  tipo('0902', 'Documentación relacionada con controversias colectivas', CAMPOS_RELACION_LABORAL),
  tipo('0903', 'Resolución que indique la afiliación sindical', CAMPOS_RELACION_LABORAL),
  tipo('0904', 'Acta que indique la afiliación sindical', CAMPOS_RELACION_LABORAL),
  tipo('0905', 'Otro documento que indique la afiliación sindical', CAMPOS_RELACION_LABORAL),

  tipo('1001', 'Cargo de entrega del Reglamento de Seguridad y Salud en el Trabajo', CAMPOS_SST, restringido),
  tipo('1002', 'Registro de entrenamiento y simulacros de emergencia', CAMPOS_SST, restringido),
  tipo('1003', 'Lista de asistencia a capacitaciones brindadas por la entidad pública', CAMPOS_SST, restringido),
  tipo('1004', 'Documentos de trámites y gestiones de seguros', CAMPOS_SST, restringido),
  tipo('1005', 'Documentos de trámites y gestiones de subsidios', CAMPOS_SST, restringido),
  tipo('1006', 'Documentos de descansos médicos', CAMPOS_SST, restringido),
  tipo('1007', 'Documentos de afiliación a Entidades Prestadoras de Salud (EPS)', CAMPOS_SST, restringido),

  tipo('1101', 'Resolución de término de designación', [], cese),
  tipo('1102', 'Resolución de término del servicio civil de carrera', [], cese),
  tipo('1103', 'Memorando de término de vínculo del servicio civil', [], cese),
  tipo('1104', 'Informe de gestión'),
  tipo('1105', 'Documento de entrega de cargo o puesto'),
  tipo('1106', 'Liquidación de beneficios sociales y/o pensión'),
  tipo('1107', 'Carta de no renovación de contrato a plazo determinado (D. Leg. N.º 1057)', [], cese),

  tipo('1201', 'Otros documentos administrativos del trabajador', CAMPOS_OTROS),
  tipo('1202', 'Comunicaciones administrativas relevantes', CAMPOS_OTROS),
  tipo('1203', 'Informes relacionados con la trayectoria laboral', CAMPOS_OTROS),
  tipo('1204', 'Documentos complementarios de recursos humanos', CAMPOS_OTROS),
  tipo('1205', 'Documentación de fiscalización posterior', CAMPOS_OTROS),
  tipo('1206', 'Otros documentos no clasificados', CAMPOS_OTROS),
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
  { tipo: '0102', regimen: null, tipoPersonal: null, aplicaA: 'TODOS' },
  { tipo: '0206', regimen: 'DL1057', tipoPersonal: null, aplicaA: 'TODOS' },
  { tipo: '0205', regimen: 'DL276', tipoPersonal: null, aplicaA: 'TODOS' },
  { tipo: '0302', regimen: null, tipoPersonal: 'ASISTENCIAL', aplicaA: 'TODOS' },
  { tipo: '1102', regimen: 'DL276', tipoPersonal: null, aplicaA: 'CESADO' },
  { tipo: '1107', regimen: 'DL1057', tipoPersonal: null, aplicaA: 'CESADO' },
];
