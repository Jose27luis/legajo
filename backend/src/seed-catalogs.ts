export type TipoCampo = 'texto' | 'fecha' | 'numero' | 'seleccion' | 'parrafo';

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
const fecha = (clave: string, etiqueta: string): CampoSeccion => ({ clave, etiqueta, tipo: 'fecha', obligatorio: false });
const seleccion = (clave: string, etiqueta: string, opciones: string[]): CampoSeccion => ({
  clave,
  etiqueta,
  tipo: 'seleccion',
  opciones,
  obligatorio: false,
});

export const SECCIONES: readonly SeccionSemilla[] = [
  {
    numero: 1,
    nombre: 'Información personal y familiar',
    carpeta: '01_Informacion_Personal_y_Familiar',
    descripcion: 'Identificación, contacto, familia y declaraciones juradas personales.',
    campos: [],
  },
  {
    numero: 2,
    nombre: 'Incorporación',
    carpeta: '02_Incorporacion',
    descripcion: 'Currículum, contratos, adendas, resoluciones de ingreso y documentos de la convocatoria.',
    campos: [
      seleccion('regimen', 'Régimen o modalidad', [
        'D. Leg. 1057 (CAS)',
        'D. Leg. 276',
        'D. Leg. 728',
        'Ley 30057',
        'Locación de servicios',
        'Otro',
      ]),
      fecha('inicioVinculo', 'Inicio del vínculo'),
      fecha('finVinculo', 'Fin del vínculo'),
      texto('dependencia', 'Área o dependencia'),
    ],
  },
  {
    numero: 3,
    nombre: 'Formación académica y capacitación',
    carpeta: '03_Formacion_Academica_y_Capacitacion',
    descripcion: 'Grados, títulos, colegiatura, habilitación, especialidades, cursos y SERUMS.',
    campos: [
      texto('institucion', 'Institución emisora'),
      texto('programa', 'Carrera, especialidad o curso'),
      fecha('fechaCulminacion', 'Fecha de culminación'),
    ],
  },
  {
    numero: 4,
    nombre: 'Experiencia laboral',
    carpeta: '04_Experiencia_Laboral',
    descripcion: 'Constancias y certificados de servicios prestados dentro o fuera de la entidad.',
    campos: [
      texto('entidad', 'Entidad donde trabajó'),
      texto('cargo', 'Cargo desempeñado'),
      fecha('inicioPeriodo', 'Inicio del período'),
      fecha('finPeriodo', 'Fin del período'),
    ],
  },
  {
    numero: 5,
    nombre: 'Movimientos del personal',
    carpeta: '05_Movimientos_del_Personal',
    descripcion: 'Rotaciones, encargaturas, destaques, reasignaciones, designaciones y cambios de funciones.',
    campos: [
      seleccion('tipoMovimiento', 'Tipo de movimiento', [
        'Rotación',
        'Destaque',
        'Reasignación',
        'Encargatura',
        'Designación',
        'Cambio de funciones',
        'Otro',
      ]),
      texto('areaOrigen', 'Área de origen'),
      texto('areaDestino', 'Área de destino'),
      fecha('fechaEfecto', 'Fecha de efecto'),
    ],
  },
  {
    numero: 6,
    nombre: 'Compensaciones',
    carpeta: '06_Compensaciones',
    descripcion: 'Remuneraciones, bonificaciones, asignaciones y beneficios laborales.',
    campos: [
      texto('concepto', 'Concepto'),
      texto('periodo', 'Período de referencia'),
      fecha('fechaEfecto', 'Fecha de efecto'),
      texto('referencia', 'Referencia administrativa'),
    ],
  },
  {
    numero: 7,
    nombre: 'Evaluación de desempeño y progresión en la carrera',
    carpeta: '07_Evaluacion_y_Progresion',
    descripcion: 'Evaluaciones, informes de desempeño, ascensos y progresión.',
    campos: [
      texto('periodo', 'Período evaluado'),
      texto('cargoEvaluado', 'Cargo evaluado'),
      texto('resultado', 'Resultado o calificación'),
      texto('areaEvaluadora', 'Área evaluadora'),
    ],
  },
  {
    numero: 8,
    nombre: 'Reconocimientos y sanciones disciplinarias',
    carpeta: '08_Reconocimientos_y_Sanciones',
    descripcion: 'Felicitaciones, reconocimientos, amonestaciones, sanciones y procesos disciplinarios.',
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
    descripcion: 'Comunicaciones, solicitudes, actas y convenios laborales.',
    campos: [
      texto('materia', 'Materia o asunto'),
      texto('instancia', 'Instancia participante'),
      fecha('fechaReunion', 'Fecha de reunión'),
      texto('expediente', 'Número de expediente'),
    ],
  },
  {
    numero: 10,
    nombre: 'Seguridad y Salud en el Trabajo y bienestar social',
    carpeta: '10_SST_y_Bienestar_Social',
    descripcion: 'Documentos de SST, aptitud ocupacional, EPP y bienestar. Sin diagnósticos ni datos clínicos.',
    campos: [
      seleccion('categoria', 'Categoría SST', ['Capacitación', 'Aptitud ocupacional', 'Prevención', 'Bienestar', 'EPP', 'Otro']),
      texto('areaResponsable', 'Área responsable'),
      fecha('vigencia', 'Vigente hasta'),
    ],
  },
  {
    numero: 11,
    nombre: 'Desvinculación',
    carpeta: '11_Desvinculacion',
    descripcion: 'Renuncias, ceses, jubilaciones, término de contrato y entrega de cargo.',
    campos: [
      seleccion('motivoCese', 'Motivo de cese', [
        'Renuncia',
        'Jubilación',
        'Fallecimiento',
        'Fin de contrato',
        'Destitución',
        'Otra causa',
      ]),
      fecha('fechaCese', 'Fecha efectiva de cese'),
      texto('sustento', 'Documento de sustento'),
      texto('areaTramite', 'Área que tramita'),
    ],
  },
  {
    numero: 12,
    nombre: 'Otros que considere la entidad',
    carpeta: '12_Otros',
    descripcion: 'Documentos que no corresponden a ninguna de las otras secciones.',
    campos: [
      texto('categoria', 'Categoría propuesta'),
      { clave: 'justificacion', etiqueta: 'Por qué va en esta sección', tipo: 'parrafo', obligatorio: true },
      texto('oficinaEmisora', 'Oficina emisora'),
    ],
  },
  {
    numero: 13,
    nombre: 'Vacaciones, licencias y permisos',
    carpeta: '13_Vacaciones_Licencias_y_Permisos',
    descripcion: 'Solicitudes, resoluciones y autorizaciones de vacaciones, licencias y permisos.',
    campos: [
      seleccion('clase', 'Clase de ausencia', ['Vacaciones', 'Licencia', 'Permiso']),
      fecha('inicio', 'Fecha de inicio'),
      fecha('fin', 'Fecha de término'),
      { clave: 'dias', etiqueta: 'Días autorizados', tipo: 'numero', obligatorio: false },
      texto('areaAutoriza', 'Área que autoriza'),
    ],
  },
];

export type TipoSemilla = [codigo: string, nombre: string, restringido: boolean, requiereNumero: boolean, tieneVencimiento: boolean];

const n = false;
const s = true;

export const TIPOS_DOCUMENTO: readonly TipoSemilla[] = [
  ['0101', 'DNI', n, n, s],
  ['0102', 'Ficha de datos personales', n, n, n],
  ['0103', 'Domicilio y contacto (sustento)', n, n, n],
  ['0104', 'Datos familiares (partidas, actas y otros sustentos)', n, n, n],
  ['0105', 'Declaración jurada personal', n, n, n],
  ['0199', 'Otro documento de identificación del trabajador', n, n, n],
  ['0201', 'Currículum vitae', n, n, n],
  ['0202', 'Contrato Administrativo de Servicios (CAS)', n, s, s],
  ['0203', 'Contrato administrativo', n, s, s],
  ['0204', 'Contrato de locación de servicios', n, s, s],
  ['0205', 'Adenda', n, s, s],
  ['0206', 'Renovación o prórroga', n, s, s],
  ['0207', 'Resolución de nombramiento', n, s, n],
  ['0208', 'Resolución CAS', n, s, n],
  ['0209', 'Documentos presentados para la contratación', n, n, n],
  ['0210', 'Declaración jurada de contratación', n, n, n],
  ['0211', 'Anexo de convocatoria', n, n, n],
  ['0212', 'Documento de adjudicación o resultado', n, n, n],
  ['0299', 'Otro documento relacionado con el ingreso o la contratación', n, n, n],
  ['0301', 'Registro Nacional de Grados Académicos y Títulos Profesionales', n, n, n],
  ['0302', 'Título profesional', n, n, n],
  ['0303', 'Grado académico', n, n, n],
  ['0304', 'Título técnico', n, n, n],
  ['0305', 'Constancia de estudios', n, n, n],
  ['0306', 'Colegiatura', n, s, n],
  ['0307', 'Constancia de habilitación profesional', n, n, s],
  ['0308', 'Especialización', n, n, n],
  ['0309', 'Registro de especialidad', n, s, n],
  ['0310', 'Certificado', n, n, n],
  ['0311', 'Curso', n, n, n],
  ['0312', 'Diplomado', n, n, n],
  ['0313', 'Taller', n, n, n],
  ['0314', 'Seminario', n, n, n],
  ['0315', 'Constancia de capacitación', n, n, n],
  ['0316', 'Resolución SERUMS', n, s, n],
  ['0399', 'Otro documento académico o de capacitación', n, n, n],
  ['0401', 'Constancia de trabajo de empleador anterior', n, n, n],
  ['0402', 'Certificado de trabajo', n, n, n],
  ['0403', 'Resolución que acredita servicios anteriores', n, s, n],
  ['0404', 'Constancia de prácticas', n, n, n],
  ['0499', 'Otro documento que acredite experiencia laboral', n, n, n],
  ['0501', 'Memorando de rotación', n, s, n],
  ['0502', 'Memorando o documento de encargatura', n, s, n],
  ['0503', 'Cambio de funciones', n, s, n],
  ['0504', 'Resolución de destaque', n, s, s],
  ['0505', 'Resolución de reasignación', n, s, n],
  ['0506', 'Resolución de designación', n, s, n],
  ['0507', 'Resolución Directoral Regional', n, s, n],
  ['0508', 'Resolución relacionada con movimientos', n, s, n],
  ['0509', 'Resolución de rotación', n, s, n],
  ['0599', 'Otro memorando de acción de personal', n, n, n],
  ['0601', 'Documento de remuneraciones', n, n, n],
  ['0602', 'Bonificación', n, n, n],
  ['0603', 'Asignación', n, n, n],
  ['0604', 'Beneficio laboral', n, n, n],
  ['0605', 'Informe de compensaciones', n, n, n],
  ['0606', 'Constancia de pago', n, n, n],
  ['0699', 'Otro documento económico', n, n, n],
  ['0701', 'Evaluación de desempeño', n, n, n],
  ['0702', 'Informe de desempeño o de jefatura', n, n, n],
  ['0703', 'Evaluación periódica', n, n, n],
  ['0704', 'Documento de ascenso o progresión', n, s, n],
  ['0705', 'Memorando relacionado con desempeño', n, s, n],
  ['0706', 'Informe de cumplimiento de metas', n, n, n],
  ['0799', 'Otro documento de evaluación laboral', n, n, n],
  ['0801', 'Reconocimiento', n, n, n],
  ['0802', 'Felicitación', n, n, n],
  ['0803', 'Memorando de reconocimiento', n, s, n],
  ['0804', 'Amonestación', s, s, n],
  ['0805', 'Memorando disciplinario', s, s, n],
  ['0806', 'Resolución sancionadora', s, s, n],
  ['0807', 'Proceso administrativo disciplinario', s, s, n],
  ['0808', 'Suspensión', s, s, n],
  ['0809', 'Carta de reconocimiento', n, n, n],
  ['0899', 'Otro documento disciplinario', s, n, n],
  ['0901', 'Comunicación laboral', n, n, n],
  ['0902', 'Solicitud sobre condiciones laborales', n, n, n],
  ['0903', 'Documento de relación individual', n, n, n],
  ['0904', 'Documento colectivo', n, n, n],
  ['0905', 'Acta de reunión laboral', n, s, n],
  ['0906', 'Convenio colectivo', n, s, n],
  ['0907', 'Resolución sobre relación laboral', n, s, n],
  ['0999', 'Otro documento de relaciones laborales', n, n, n],
  ['1001', 'Documento de SST', n, n, n],
  ['1002', 'Evaluación o aptitud ocupacional', s, n, s],
  ['1003', 'Documento de bienestar social', n, n, n],
  ['1004', 'Licencia o descanso médico de origen ocupacional', s, n, n],
  ['1005', 'Constancia de inducción SST', n, n, n],
  ['1006', 'Constancia de capacitación SST', n, n, n],
  ['1007', 'Acta de entrega de EPP', n, n, n],
  ['1099', 'Otro documento de SST o bienestar', n, n, n],
  ['1101', 'Carta de renuncia', n, n, n],
  ['1102', 'Resolución de cese', n, s, n],
  ['1103', 'Resolución por término o finalización de contrato', n, s, n],
  ['1104', 'Constancia de trabajo emitida por la entidad', n, n, n],
  ['1105', 'Liquidación', n, n, n],
  ['1106', 'Entrega de cargo', n, n, n],
  ['1107', 'Resolución de jubilación', n, s, n],
  ['1108', 'Sustento de fallecimiento', s, n, n],
  ['1199', 'Otro documento de salida', n, n, n],
  ['1201', 'Comunicación administrativa', n, n, n],
  ['1202', 'Documentación complementaria', n, n, n],
  ['1203', 'Anexo', n, n, n],
  ['1204', 'Informe complementario', n, n, n],
  ['1299', 'Documento que no corresponde a otra sección', n, n, n],
  ['1301', 'Resolución de vacaciones', n, s, n],
  ['1302', 'Solicitud de vacaciones', n, n, n],
  ['1303', 'Rol de vacaciones', n, n, n],
  ['1304', 'Licencia con goce', n, n, n],
  ['1305', 'Licencia sin goce', n, n, n],
  ['1306', 'Autorización de permiso', n, n, n],
  ['1307', 'Descanso médico', s, n, n],
  ['1308', 'Solicitud de licencia', n, n, n],
  ['1309', 'Resolución de licencia', n, s, n],
  ['1310', 'Solicitud de permiso', n, n, n],
  ['1311', 'Documento de reincorporación', n, n, n],
  ['1399', 'Otro documento de ausencias autorizadas', n, n, n],
];

export const REGIMENES: ReadonlyArray<{ codigo: string; nombre: string; esLaboral: boolean }> = [
  { codigo: 'DL276', nombre: 'D. Leg. 276', esLaboral: true },
  { codigo: 'DL728', nombre: 'D. Leg. 728', esLaboral: true },
  { codigo: 'DL1057', nombre: 'D. Leg. 1057 (CAS)', esLaboral: true },
  { codigo: 'L30057', nombre: 'Ley 30057 (Servicio Civil)', esLaboral: true },
  { codigo: 'LOCACION', nombre: 'Locación de servicios', esLaboral: false },
];

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
