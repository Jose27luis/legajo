export type TipoCampo = 'texto' | 'fecha' | 'numero' | 'seleccion' | 'parrafo' | 'regimen' | 'area' | 'cargo' | 'contrato';

export type AccionTipo = 'NINGUNA' | 'VINCULO' | 'MOVIMIENTO' | 'CESE';

export type CampoSeccion = {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  dependeDe?: { clave: string; opciones: Record<string, string[]> };
  obligatorio: boolean;
};

export type FormularioTipo = {
  numero?: string;
  fechaEmision?: string;
  emisor?: string;
  emisorOpciones?: string[];
  fechaVencimiento?: string;
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
const catalogo = (clave: string, etiqueta: string, tipo: 'regimen' | 'area' | 'cargo' | 'contrato', obligatorio = false): CampoSeccion => ({
  clave,
  etiqueta,
  tipo,
  obligatorio,
});

export const TIPOS_MOVIMIENTO = ['Rotación', 'Destaque', 'Reasignación', 'Encargatura', 'Designación', 'Cambio de funciones', 'Otro'];
export const MOTIVOS_CESE = ['Renuncia', 'Jubilación', 'Fallecimiento', 'Fin de contrato', 'Destitución', 'Otra causa'];

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
    descripcion: 'Proceso de selección, formalización del vínculo, inducción del personal y período de prueba.',
    campos: [],
  },
  {
    numero: 3,
    nombre: 'Formación académica y capacitación',
    carpeta: '03_Formacion_Academica_y_Capacitacion',
    descripcion: 'Estudios básicos, títulos y grados, colegiatura, postgrados, maestrías, doctorados y capacitaciones.',
    campos: [],
  },
  {
    numero: 4,
    nombre: 'Experiencia laboral',
    carpeta: '04_Experiencia_Laboral',
    descripcion: 'Documentos que acreditan la experiencia en entidades públicas o privadas presentados en el proceso de selección.',
    campos: [],
  },
  {
    numero: 5,
    nombre: 'Movimientos del personal',
    carpeta: '05_Movimientos_del_Personal',
    descripcion: 'Licencias, permisos, goce, adelanto o postergación de vacaciones y rol de vacaciones.',
    campos: [],
  },
  {
    numero: 6,
    nombre: 'Compensaciones',
    carpeta: '06_Compensaciones',
    descripcion: 'Reconocimiento de tiempo de servicios, compensaciones, retenciones tributarias y liquidación de beneficios sociales.',
    campos: [],
  },
  {
    numero: 7,
    nombre: 'Evaluación de desempeño, progresión en la carrera y desplazamiento',
    carpeta: '07_Desempeno_Carrera_y_Desplazamiento',
    descripcion: 'Evaluación de desempeño, progresión en la carrera, designación, rotación, destaque y encargo.',
    campos: [],
  },
  {
    numero: 8,
    nombre: 'Reconocimientos y sanciones disciplinarias',
    carpeta: '08_Reconocimientos_y_Sanciones',
    descripcion: 'Reconocimientos, sanciones disciplinarias y recursos impugnatorios de sanciones.',
    campos: [],
  },
  {
    numero: 9,
    nombre: 'Relaciones laborales individuales y colectivas',
    carpeta: '09_Relaciones_Laborales',
    descripcion: 'Controversias laborales individuales y colectivas y afiliación sindical.',
    campos: [],
  },
  {
    numero: 10,
    nombre: 'Seguridad y Salud en el Trabajo (SST) y bienestar social',
    carpeta: '10_SST_y_Bienestar_Social',
    descripcion: 'Reglamento de SST, simulacros, capacitaciones de SST, seguros, subsidios, descansos médicos y EPS.',
    campos: [],
  },
  {
    numero: 11,
    nombre: 'Desvinculación',
    carpeta: '11_Desvinculacion',
    descripcion: 'Término de designación o del vínculo, informe de gestión, entrega de cargo, liquidación y no renovación.',
    campos: [],
  },
  {
    numero: 12,
    nombre: 'Otros que considere la entidad',
    carpeta: '12_Otros_que_Considere_la_Entidad',
    descripcion: 'Documentos que no corresponden a ninguna de las otras 11 secciones.',
    campos: [],
  },
];

const ACCIONES_CARRERA = ['Nombramiento', 'Ascenso', 'Cambio de nivel', 'Reasignación', 'Otra acción de carrera'];
const MOTIVOS_ADENDA = [
  'Renovación de contrato',
  'Ampliación del plazo',
  'Modificación de remuneración',
  'Modificación de funciones',
  'Modificación de jornada laboral',
  'Modificación del lugar de prestación',
  'Corrección de datos contractuales',
  'Otras modificaciones',
];
const NIVELES_ESTUDIO = ['Primaria', 'Secundaria'];
const GRADOS_TITULOS = [
  'Grado de Bachiller',
  'Título Profesional Universitario',
  'Título Profesional Técnico',
  'Título Técnico',
  'Grado de Bachiller Técnico',
  'Título de Segunda Especialidad Profesional',
  'Otro título o grado superior',
];
const ACREDITACIONES_COLEGIATURA = [
  'Diploma de colegiatura',
  'Constancia de colegiatura',
  'Constancia de habilitación profesional',
  'Certificado de habilitación profesional',
  'Otro documento de colegiatura o habilitación',
];
const COLEGIOS_PROFESIONALES = [
  'Colegio Médico del Perú',
  'Colegio de Enfermeros del Perú',
  'Colegio de Obstetras del Perú',
  'Colegio Odontológico del Perú',
  'Colegio Químico Farmacéutico del Perú',
  'Colegio de Tecnólogos Médicos del Perú',
  'Colegio de Psicólogos del Perú',
  'Colegio de Biólogos del Perú',
  'Colegio de Nutricionistas del Perú',
  'Colegio de Trabajadores Sociales del Perú',
  'Colegio de Abogados',
  'Colegio de Ingenieros del Perú',
  'Colegio de Contadores Públicos',
  'Colegio de Administradores del Perú',
  'Otro colegio profesional',
];
const MOTIVOS_LICENCIA = [
  'Licencia por Maternidad',
  'Licencia por Paternidad',
  'Licencia por Adopción',
  'Licencia por Motivos de salud',
  'Licencia Sindical',
  'Licencia por Familiares graves',
  'Licencia para funciones del Comité de SST',
  'Licencia por servicio como Bombero voluntario',
  'Licencia por Motivos particulares',
  'Otras licencias',
];
const MOTIVOS_PERMISO = [
  'Permiso por Lactancia materna',
  'Permiso por Atención médica',
  'Permiso por Asistencia médica a familiar',
  'Permiso por Motivos particulares',
  'Permiso Sindical',
  'Permiso para funciones del Comité de SST',
  'Permiso por servicio como Bombero voluntario',
  'Otros permisos',
];
const TIPOS_LICENCIA = [
  'Licencia por maternidad',
  'Licencia por paternidad',
  'Licencia por adopción',
  'Licencia por lactancia',
  'Licencia sindical',
  'Licencia por familiares graves',
  'Licencia por funciones del Comité de SST',
  'Licencia por asistencia médica a un familiar',
  'Licencia por servicio como bombero voluntario',
  'Licencia por motivos de salud',
  'Licencia por motivos particulares',
  'Otras licencias',
];

const descripcion = (numero: string, fechaEmision: string, emisor?: string): FormularioTipo =>
  emisor === undefined ? { numero, fechaEmision } : { numero, fechaEmision, emisor };

const FORMULARIO_SELECCION: FormularioTipo = {
  numero: 'Número de documento',
  fechaEmision: 'Fecha de emisión',
  emisor: 'Emitido por',
  emisorOpciones: ['Comité de selección'],
};
const FORMULARIO_INDUCCION = descripcion('Número de documento', 'Fecha de emisión o entrega', 'Emitido o entregado por');
const FORMULARIO_ESTUDIOS = descripcion('Número de certificado o diploma', 'Fecha de emisión', 'Institución emisora');
const FORMULARIO_ENTIDAD = descripcion('Número de documento', 'Fecha de emisión', 'Entidad o institución emisora');
const FORMULARIO_EXPEDIENTE = descripcion('Número de documento o expediente', 'Fecha de emisión', 'Entidad u organismo emisor');
const FORMULARIO_DESPLAZAMIENTO = descripcion('Número de documento', 'Fecha de emisión');

const CAMPOS_CONCURSO: CampoSeccion[] = [texto('concurso', 'Concurso / convocatoria')];
const CAMPOS_DESIGNACION: CampoSeccion[] = [
  fecha('inicio', 'Inicio de designación'),
  fecha('fin', 'Fin de designación'),
  catalogo('puesto', 'Cargo designado', 'cargo'),
  catalogo('dependencia', 'Área de dependencia', 'area'),
];
const CAMPOS_RENOVACION: CampoSeccion[] = [
  fecha('inicio', 'Inicio de la renovación'),
  fecha('fin', 'Fin de la renovación'),
  catalogo('puesto', 'Cargo o puesto', 'cargo'),
  catalogo('dependencia', 'Área de dependencia', 'area'),
];
const CAMPOS_CARRERA: CampoSeccion[] = [
  fecha('inicio', 'Fecha de efecto'),
  seleccion('accionAdministrativa', 'Acción administrativa', ACCIONES_CARRERA),
  catalogo('puesto', 'Cargo o puesto', 'cargo'),
];
const CAMPOS_CONTRATO: CampoSeccion[] = [
  catalogo('regimen', 'Régimen o modalidad', 'regimen'),
  fecha('inicio', 'Inicio del vínculo'),
  fecha('fin', 'Fin del vínculo'),
  catalogo('puesto', 'Cargo o puesto', 'cargo'),
  catalogo('dependencia', 'Área de dependencia', 'area'),
];
const CAMPOS_ADENDA: CampoSeccion[] = [
  catalogo('contratoRelacionado', 'Contrato relacionado', 'contrato'),
  seleccion('motivoAdenda', 'Motivo de la adenda', MOTIVOS_ADENDA),
  fecha('inicio', 'Inicio del período modificado'),
  fecha('fin', 'Fin del período modificado'),
];
const CAMPOS_PRUEBA: CampoSeccion[] = [
  fecha('periodoDesde', 'Período de prueba desde'),
  fecha('periodoHasta', 'Período de prueba hasta'),
  seleccion('resultadoEvaluacion', 'Resultado de evaluación', ['Aprobado', 'No aprobado']),
];
const CAMPOS_ESTUDIOS_BASICOS: CampoSeccion[] = [
  seleccion('nivelEstudios', 'Nivel de estudios', NIVELES_ESTUDIO),
  texto('nombreDocumento', 'Nombre del documento'),
];
const CAMPOS_TITULO: CampoSeccion[] = [
  seleccion('tipoGrado', 'Tipo de grado o título', GRADOS_TITULOS),
  texto('nombreDocumento', 'Nombre del título o grado'),
];
const CAMPOS_COLEGIATURA: CampoSeccion[] = [
  seleccion('tipoAcreditacion', 'Tipo de acreditación', ACREDITACIONES_COLEGIATURA),
  seleccion('colegioProfesional', 'Colegio profesional', COLEGIOS_PROFESIONALES),
];
const CAMPOS_NOMBRE: CampoSeccion[] = [texto('nombreDocumento', 'Nombre del documento')];
const CAMPOS_TIEMPO_SERVICIO: CampoSeccion[] = [
  texto('cargo', 'Cargo desempeñado'),
  fecha('inicio', 'Inicio del servicio'),
  fecha('fin', 'Fin del servicio'),
];
const CAMPOS_FUNCIONES: CampoSeccion[] = [
  texto('cargo', 'Cargo o función asignada'),
  fecha('inicio', 'Inicio de funciones'),
  fecha('fin', 'Fin de funciones'),
];
const CAMPOS_LICENCIA_PERMISO: CampoSeccion[] = [
  seleccion('tipoSolicitud', 'Tipo de solicitud', ['Licencia', 'Permiso']),
  {
    clave: 'motivoSolicitud',
    etiqueta: 'Motivo de licencia o permiso',
    tipo: 'seleccion',
    opciones: [...MOTIVOS_LICENCIA, ...MOTIVOS_PERMISO],
    dependeDe: { clave: 'tipoSolicitud', opciones: { Licencia: MOTIVOS_LICENCIA, Permiso: MOTIVOS_PERMISO } },
    obligatorio: false,
  },
  fecha('inicio', 'Fecha de inicio'),
  fecha('fin', 'Fecha de fin'),
];
const CAMPOS_GOCE: CampoSeccion[] = [
  texto('periodoVacacional', 'Período vacacional'),
  fecha('inicio', 'Inicio de vacaciones'),
  fecha('fin', 'Fin de vacaciones'),
];
const CAMPOS_ADELANTO: CampoSeccion[] = [
  seleccion('accionVacacional', 'Acción vacacional', ['Adelanto de vacaciones', 'Postergación de vacaciones']),
  texto('periodoVacacional', 'Período vacacional'),
  fecha('inicio', 'Nueva fecha de inicio'),
  fecha('fin', 'Nueva fecha de fin'),
];
const CAMPOS_ROL: CampoSeccion[] = [texto('anioRol', 'Año del rol vacacional'), texto('dependenciaRol', 'Dependencia o área')];
const CAMPOS_LICENCIA_OTORGADA: CampoSeccion[] = [
  seleccion('tipoLicencia', 'Tipo de licencia', TIPOS_LICENCIA),
  fecha('inicio', 'Fecha de inicio'),
  fecha('fin', 'Fecha de fin'),
];
const CAMPOS_TIEMPO_RECONOCIDO: CampoSeccion[] = [
  texto('tiempoReconocido', 'Tiempo de servicios reconocido'),
  fecha('fechaEfecto', 'Fecha de reconocimiento o efecto'),
];
const CAMPOS_CONCEPTO_PERIODO: CampoSeccion[] = [
  texto('concepto', 'Concepto o motivo'),
  fecha('periodoInicio', 'Período de inicio'),
  fecha('periodoFin', 'Período de fin'),
];
const desplazamiento = (cargo: string, origen = 'Dependencia de origen', destino = 'Dependencia de destino'): CampoSeccion[] => [
  catalogo('areaOrigen', origen, 'area'),
  catalogo('areaDestino', destino, 'area'),
  texto('cargoAsignado', cargo),
  fecha('fechaEfecto', 'Fecha de inicio o efecto'),
];
const CAMPOS_RECONOCIMIENTO: CampoSeccion[] = [
  texto('motivoReconocimiento', 'Motivo del reconocimiento'),
  fecha('fechaReconocimiento', 'Fecha del reconocimiento'),
];
const CAMPOS_SANCION: CampoSeccion[] = [
  seleccion('tipoSancion', 'Tipo de sanción', ['Amonestación escrita', 'Suspensión', 'Destitución']),
  fecha('fechaEfecto', 'Fecha de inicio o efecto'),
];
const CAMPOS_RECURSO: CampoSeccion[] = [
  seleccion('resultadoRecurso', 'Resultado del recurso', ['Fundado', 'Infundado', 'Improcedente']),
  fecha('fechaEfecto', 'Fecha de inicio o efecto'),
];
const CAMPOS_CONTROVERSIA: CampoSeccion[] = [texto('asunto', 'Asunto o motivo'), fecha('fechaResolucion', 'Fecha de resolución')];
const CAMPOS_SST_PARTICIPACION: CampoSeccion[] = [
  texto('asunto', 'Asunto o motivo'),
  fecha('fechaParticipacion', 'Fecha de recepción o participación'),
];
const CAMPOS_BIENESTAR: CampoSeccion[] = [texto('asunto', 'Asunto o motivo'), fecha('fechaEfecto', 'Fecha de inicio o efecto')];
const CAMPOS_TERMINO: CampoSeccion[] = [texto('asunto', 'Asunto o motivo'), fecha('fechaTermino', 'Fecha de término o efecto')];
const CAMPOS_CESE: CampoSeccion[] = [
  seleccion('motivoCese', 'Motivo de cese', MOTIVOS_CESE),
  texto('asunto', 'Asunto o motivo'),
  fecha('fechaCese', 'Fecha de término o efecto'),
];
const CAMPOS_OTROS: CampoSeccion[] = [texto('nombreDocumento', 'Nombre del documento'), texto('asunto', 'Asunto o motivo')];

export interface TipoSemilla {
  codigo: string;
  nombre: string;
  restringido: boolean;
  requiereNumero: boolean;
  tieneVencimiento: boolean;
  accion: AccionTipo;
  campos: CampoSeccion[];
  formulario: FormularioTipo;
}

type Opciones = Partial<Pick<TipoSemilla, 'restringido' | 'tieneVencimiento' | 'accion'>>;

const tipo = (
  codigo: string,
  nombre: string,
  formulario: FormularioTipo,
  campos: CampoSeccion[] = [],
  opciones: Opciones = {},
): TipoSemilla => ({
  codigo,
  nombre,
  restringido: opciones.restringido ?? false,
  requiereNumero: false,
  tieneVencimiento: opciones.tieneVencimiento ?? false,
  accion: opciones.accion ?? 'NINGUNA',
  campos,
  formulario,
});

const vinculo = { accion: 'VINCULO' } as const;
const movimiento = { accion: 'MOVIMIENTO' } as const;
const cese = { accion: 'CESE' } as const;
const restringido = { restringido: true } as const;

const FORMULARIO_IDENTIDAD: FormularioTipo = {
  numero: 'Número de documento',
  fechaEmision: 'Fecha de emisión del documento',
  emisor: 'Emitido por',
  fechaVencimiento: 'Fecha de vencimiento',
};

export const CODIGO_FICHA_TEXTO = '0101';

export const TIPOS_DOCUMENTO: readonly TipoSemilla[] = [
  tipo(CODIGO_FICHA_TEXTO, 'Ficha de datos del servidor civil (SOLO TEXTO)', FORMULARIO_IDENTIDAD),
  tipo('0102', 'Copia del DNI o documento equivalente', FORMULARIO_IDENTIDAD, [], { tieneVencimiento: true }),
  tipo('0103', 'Declaración jurada o certificado de antecedentes penales', FORMULARIO_IDENTIDAD),
  tipo('0104', 'Declaración jurada o certificado de antecedentes policiales', FORMULARIO_IDENTIDAD),
  tipo('0105', 'Declaración jurada de bienes y rentas, cuando corresponda', FORMULARIO_IDENTIDAD),
  tipo('0106', 'Declaración jurada de no tener impedimentos para designación, según Ley N.º 31419', FORMULARIO_IDENTIDAD),
  tipo('0107', 'Partida de matrimonio o constancia de unión de hecho', FORMULARIO_IDENTIDAD),
  tipo('0108', 'Información de impedimentos e inhabilitaciones (RNSSC, REDJUM, entre otros)', FORMULARIO_IDENTIDAD),
  tipo('0109', 'Copia del DNI del cónyuge o conviviente', FORMULARIO_IDENTIDAD),
  tipo('0110', 'Copia del DNI de los hijos menores de edad', FORMULARIO_IDENTIDAD),
  tipo('0111', 'Certificado de discapacidad emitido por CONADIS, cuando corresponda', FORMULARIO_IDENTIDAD),
  tipo('0112', 'Otras declaraciones juradas que correspondan', FORMULARIO_IDENTIDAD),

  tipo('0201', 'Resultado final del proceso de selección donde el servidor resultó ganador', FORMULARIO_SELECCION, CAMPOS_CONCURSO),
  tipo(
    '0202',
    'Informe de Recursos Humanos que verifica el cumplimiento de los requisitos del puesto, cuando corresponda',
    FORMULARIO_SELECCION,
    CAMPOS_CONCURSO,
  ),
  tipo(
    '0203',
    'Resolución administrativa de designación',
    descripcion('Número de resolución', 'Fecha de emisión'),
    CAMPOS_DESIGNACION,
    vinculo,
  ),
  tipo(
    '0204',
    'Resolución administrativa de renovación',
    descripcion('Número de resolución', 'Fecha de emisión'),
    CAMPOS_RENOVACION,
    vinculo,
  ),
  tipo(
    '0205',
    'Resolución administrativa del servicio civil de carrera',
    descripcion('Número de resolución', 'Fecha de emisión'),
    CAMPOS_CARRERA,
    vinculo,
  ),
  tipo('0206', 'Contrato', descripcion('Número de contrato', 'Fecha de emisión'), CAMPOS_CONTRATO, vinculo),
  tipo('0207', 'Adenda', descripcion('Número de adenda', 'Fecha de emisión'), CAMPOS_ADENDA, vinculo),
  tipo('0208', 'Registro de inducción general y específica', FORMULARIO_INDUCCION),
  tipo('0209', 'Cargo de entrega del perfil del puesto y funciones', FORMULARIO_INDUCCION),
  tipo('0210', 'Cargo de entrega del reglamento interno de servidores civiles', FORMULARIO_INDUCCION),
  tipo('0211', 'Cargo de entrega del código de conducta y ética', FORMULARIO_INDUCCION),
  tipo('0212', 'Otros documentos similares', FORMULARIO_INDUCCION),
  tipo(
    '0213',
    'Evaluación y resultados del período de prueba',
    descripcion('Número de documento', 'Fecha de evaluación', 'Evaluado por'),
    CAMPOS_PRUEBA,
  ),

  tipo(
    '0301',
    'Certificado oficial de estudios básicos, cuando corresponda',
    { fechaEmision: 'Fecha de emisión', emisor: 'Institución emisora' },
    CAMPOS_ESTUDIOS_BASICOS,
  ),
  tipo(
    '0302',
    'Títulos o grados de estudios superiores técnicos o universitarios',
    descripcion('Número de diploma o resolución', 'Fecha de emisión', 'Institución emisora'),
    CAMPOS_TITULO,
  ),
  tipo(
    '0303',
    'Colegiatura y habilitación profesional',
    { numero: 'Número de colegiatura', fechaEmision: 'Fecha de emisión', fechaVencimiento: 'Fecha de vencimiento de habilitación' },
    CAMPOS_COLEGIATURA,
    { tieneVencimiento: true },
  ),
  tipo('0304', 'Certificados o diplomas de postgrado (diplomados o programas de especialización)', FORMULARIO_ESTUDIOS, CAMPOS_NOMBRE),
  tipo('0305', 'Diploma de grado académico de Maestría o Doctorado', FORMULARIO_ESTUDIOS, CAMPOS_NOMBRE),
  tipo('0306', 'Certificados, constancias o diplomas de cursos y programas de capacitación', FORMULARIO_ESTUDIOS, CAMPOS_NOMBRE),
  tipo(
    '0307',
    'Constancias de participación en congresos, convenciones, seminarios, talleres, fórums, simposios, conferencias, charlas y similares',
    FORMULARIO_ESTUDIOS,
    CAMPOS_NOMBRE,
  ),
  tipo('0308', 'Otros documentos relacionados con la formación académica y capacitación', FORMULARIO_ESTUDIOS, CAMPOS_NOMBRE),

  tipo('0401', 'Documentos que acreditan tiempo de servicio', FORMULARIO_ENTIDAD, CAMPOS_TIEMPO_SERVICIO),
  tipo('0402', 'Documentos que acreditan funciones desempeñadas', FORMULARIO_ENTIDAD, CAMPOS_FUNCIONES),

  tipo(
    '0501',
    'Documento de aprobación de licencias y permisos',
    descripcion('Número de documento', 'Fecha de emisión'),
    CAMPOS_LICENCIA_PERMISO,
  ),
  tipo('0502', 'Documentos de goce vacacional', descripcion('Número de documento', 'Fecha de emisión'), CAMPOS_GOCE),
  tipo(
    '0503',
    'Documentos de adelanto o postergación de vacaciones',
    descripcion('Número de documento', 'Fecha de emisión'),
    CAMPOS_ADELANTO,
  ),
  tipo('0504', 'Rol de vacaciones', descripcion('Número de documento', 'Fecha de aprobación o emisión'), CAMPOS_ROL),
  tipo('0505', 'Licencias otorgadas', descripcion('Número de documento', 'Fecha de otorgamiento'), CAMPOS_LICENCIA_OTORGADA),

  tipo(
    '0601',
    'Reconocimiento de tiempo de servicios',
    descripcion('Número de documento', 'Fecha de emisión', 'Entidad emisora'),
    CAMPOS_TIEMPO_RECONOCIDO,
  ),
  tipo('0602', 'Pago de compensaciones económicas y no económicas', FORMULARIO_ENTIDAD, CAMPOS_CONCEPTO_PERIODO),
  tipo('0603', 'Certificados de retenciones tributarias', FORMULARIO_ENTIDAD, CAMPOS_CONCEPTO_PERIODO),
  tipo('0604', 'Liquidación de beneficios sociales', FORMULARIO_ENTIDAD, CAMPOS_CONCEPTO_PERIODO),

  tipo('0701', 'Formato para la gestión del rendimiento', FORMULARIO_ENTIDAD, CAMPOS_CONCEPTO_PERIODO),
  tipo('0702', 'Actas de retroalimentación y plan de mejora', FORMULARIO_ENTIDAD, CAMPOS_CONCEPTO_PERIODO),
  tipo('0703', 'Resolución de progresión en la carrera', FORMULARIO_ENTIDAD, CAMPOS_CONCEPTO_PERIODO),
  tipo('0704', 'Designación', FORMULARIO_DESPLAZAMIENTO, desplazamiento('Cargo designado'), movimiento),
  tipo('0705', 'Rotación', FORMULARIO_DESPLAZAMIENTO, desplazamiento('Cargo o función asignada'), movimiento),
  tipo(
    '0706',
    'Destaque',
    FORMULARIO_DESPLAZAMIENTO,
    desplazamiento('Cargo o función asignada', 'Dependencia o entidad de origen', 'Dependencia o entidad de destino'),
    movimiento,
  ),
  tipo('0707', 'Encargo de puestos o funciones', FORMULARIO_DESPLAZAMIENTO, desplazamiento('Puesto o función encargada'), movimiento),
  tipo('0708', 'Otros documentos de desplazamiento', FORMULARIO_DESPLAZAMIENTO, desplazamiento('Cargo o función asignada'), movimiento),

  tipo('0801', 'Reconocimientos por participación en proyectos o eventos', FORMULARIO_ENTIDAD, CAMPOS_RECONOCIMIENTO, restringido),
  tipo('0802', 'Reconocimientos por labor docente', FORMULARIO_ENTIDAD, CAMPOS_RECONOCIMIENTO, restringido),
  tipo('0803', 'Reconocimientos por tiempo de servicios', FORMULARIO_ENTIDAD, CAMPOS_RECONOCIMIENTO, restringido),
  tipo('0804', 'Documentos de sanciones disciplinarias', FORMULARIO_ENTIDAD, CAMPOS_SANCION, restringido),
  tipo('0805', 'Documentos sobre recursos impugnatorios de sanciones', FORMULARIO_ENTIDAD, CAMPOS_RECURSO, restringido),

  tipo('0901', 'Documentos de controversias individuales', FORMULARIO_EXPEDIENTE, CAMPOS_CONTROVERSIA),
  tipo('0902', 'Documentos de controversias colectivas', FORMULARIO_EXPEDIENTE, CAMPOS_CONTROVERSIA),
  tipo('0903', 'Documentos de afiliación sindical', FORMULARIO_EXPEDIENTE, CAMPOS_CONTROVERSIA),

  tipo(
    '1001',
    'Cargo de entrega del Reglamento de SST',
    descripcion('Número de documento', 'Fecha de emisión o entrega', 'Entidad o institución emisora'),
    CAMPOS_SST_PARTICIPACION,
    restringido,
  ),
  tipo(
    '1002',
    'Registro de entrenamientos y simulacros de emergencia',
    descripcion('Número de documento', 'Fecha de emisión o registro', 'Entidad o institución emisora'),
    CAMPOS_SST_PARTICIPACION,
    restringido,
  ),
  tipo(
    '1003',
    'Lista de asistencia a capacitaciones de SST',
    descripcion('Número de documento', 'Fecha de emisión o registro', 'Entidad o institución emisora'),
    CAMPOS_SST_PARTICIPACION,
    restringido,
  ),
  tipo('1004', 'Trámites y gestiones de seguros', FORMULARIO_ENTIDAD, CAMPOS_BIENESTAR, restringido),
  tipo('1005', 'Trámites y gestiones de subsidios', FORMULARIO_ENTIDAD, CAMPOS_BIENESTAR, restringido),
  tipo('1006', 'Descansos médicos', FORMULARIO_ENTIDAD, CAMPOS_BIENESTAR, restringido),
  tipo('1007', 'Afiliaciones a Entidades Prestadoras de Salud (EPS)', FORMULARIO_ENTIDAD, CAMPOS_BIENESTAR, restringido),

  tipo('1101', 'Resolución de término de designación', FORMULARIO_ENTIDAD, CAMPOS_TERMINO),
  tipo('1102', 'Resolución de término del servicio civil de carrera', FORMULARIO_ENTIDAD, CAMPOS_CESE, cese),
  tipo('1103', 'Memorando de término del vínculo laboral', FORMULARIO_ENTIDAD, CAMPOS_CESE, cese),
  tipo('1104', 'Informe de gestión', FORMULARIO_ENTIDAD, CAMPOS_TERMINO),
  tipo('1105', 'Entrega de cargo o puesto', FORMULARIO_ENTIDAD, CAMPOS_TERMINO),
  tipo('1106', 'Liquidación de beneficios sociales y/o pensión', FORMULARIO_ENTIDAD, CAMPOS_TERMINO),
  tipo('1107', 'Carta de no renovación de contrato a plazo determinado (D. Leg. N.º 1057)', FORMULARIO_ENTIDAD, CAMPOS_CESE, cese),

  tipo('1201', 'Otros documentos administrativos del trabajador', FORMULARIO_ENTIDAD, CAMPOS_OTROS),
  tipo('1202', 'Comunicaciones administrativas relevantes', FORMULARIO_ENTIDAD, CAMPOS_OTROS),
  tipo('1203', 'Informes relacionados con la trayectoria laboral', FORMULARIO_ENTIDAD, CAMPOS_OTROS),
  tipo('1204', 'Documentos complementarios de recursos humanos', FORMULARIO_ENTIDAD, CAMPOS_OTROS),
  tipo('1205', 'Documentación de fiscalización posterior', FORMULARIO_ENTIDAD, CAMPOS_OTROS),
  tipo('1206', 'Otros documentos no clasificados', FORMULARIO_ENTIDAD, CAMPOS_OTROS),
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
