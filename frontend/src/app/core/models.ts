export interface UsuarioSesion {
  id: string;
  usuario: string;
  nombreCompleto: string;
  correo: string;
  rol: string;
  permisos: string[];
  debeCambiarClave: boolean;
  ultimoAcceso: string | null;
}

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface Usuario {
  id: string;
  usuario: string;
  nombreCompleto: string;
  correo: string;
  rol: { id: string; nombre: string };
  activo: boolean;
  bloqueadoHasta: string | null;
  debeCambiarClave: boolean;
  ultimoAcceso: string | null;
  creadoEn: string;
}

export interface ClaveTemporal {
  usuario: Usuario;
  claveTemporal: string;
}

export interface DatosUsuario {
  nombreCompleto: string;
  correo: string;
  rolId: string;
}

export interface NuevoUsuario extends DatosUsuario {
  usuario: string;
}

export type TipoCampo = 'texto' | 'fecha' | 'numero' | 'seleccion' | 'parrafo' | 'regimen' | 'area' | 'cargo' | 'contrato';
export type AccionDocumento = 'NINGUNA' | 'VINCULO' | 'MOVIMIENTO' | 'CESE';

export interface CampoSeccion {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  dependeDe?: { clave: string; opciones: Record<string, string[]> };
  obligatorio: boolean;
}

export interface FormularioTipo {
  numero?: string;
  fechaEmision?: string;
  emisor?: string;
  emisorOpciones?: string[];
  fechaVencimiento?: string;
  presentadoPor?: string;
}

export interface TipoDocumento {
  id: number;
  seccionId: number;
  codigo: string;
  nombre: string;
  restringido: boolean;
  requiereNumero: boolean;
  tieneVencimiento: boolean;
  activo: boolean;
  orden: number;
  accion: AccionDocumento;
  campos: CampoSeccion[];
  formulario: FormularioTipo;
}

export interface Seccion {
  id: number;
  numero: number;
  nombre: string;
  carpeta: string;
  descripcion: string;
  campos: CampoSeccion[];
  tipos: TipoDocumento[];
}

export interface DatosTipoDocumento {
  nombre: string;
  restringido: boolean;
  requiereNumero: boolean;
  tieneVencimiento: boolean;
}

export interface Regimen {
  id: number;
  codigo: string;
  nombre: string;
  esLaboral: boolean;
  activo: boolean;
}

export interface Area {
  id: number;
  nombre: string;
  padreId: number | null;
  padreNombre: string | null;
  activo: boolean;
}

export interface Cargo {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface ProvinciaUbigeo {
  nombre: string;
  distritos: string[];
}

export interface DepartamentoUbigeo {
  nombre: string;
  provincias: ProvinciaUbigeo[];
}

export interface GradoInstruccion {
  nombre: string;
  profesiones: string[];
  condiciones: string[];
}

export interface Formacion {
  gradoInstruccion: string | null;
  profesion: string | null;
  condicionProfesion: string | null;
}

export type TipoPersonal = 'ADMINISTRATIVO' | 'ASISTENCIAL';
export type AplicaA = 'ACTIVO' | 'CESADO' | 'TODOS';

export interface Requisito {
  id: number;
  tipoDocumento: TipoDocumento;
  regimen: Regimen | null;
  tipoPersonal: TipoPersonal | null;
  aplicaA: AplicaA;
}

export interface NuevoRequisito {
  tipoDocumentoId: number;
  regimenId: number | null;
  tipoPersonal: TipoPersonal | null;
  aplicaA: AplicaA;
}

export type TipoDocIdentidad = 'DNI' | 'CE';
export type EstadoTrabajador = 'ACTIVO' | 'CESADO';
export type Movimiento =
  'SIN_MOVIMIENTO' | 'ROTACION' | 'DESTAQUE' | 'ENCARGATURA' | 'REASIGNACION' | 'DESIGNACION' | 'CAMBIO_FUNCIONES' | 'OTRO';
export type MotivoCese = 'RENUNCIA' | 'JUBILACION' | 'FALLECIMIENTO' | 'FIN_CONTRATO' | 'DESTITUCION' | 'OTRA_CAUSA';
export type MotivoCambio = 'RENOVACION' | 'CAMBIO_REGIMEN' | 'CAMBIO_CARGO_O_AREA';
export type MotivoFin = MotivoCese | MotivoCambio;

export interface ReferenciaCatalogo {
  id: number;
  nombre: string;
}

export interface Vinculo {
  id: string;
  regimen: ReferenciaCatalogo;
  tipoPersonal: TipoPersonal;
  cargo: ReferenciaCatalogo;
  area: ReferenciaCatalogo;
  fechaInicio: string;
  fechaFin: string | null;
  motivoFin: MotivoFin | null;
  referencia: string | null;
  actual: boolean;
}

export interface TrabajadorResumen {
  id: string;
  tipoDocIdentidad: TipoDocIdentidad;
  numeroDoc: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  estado: EstadoTrabajador;
  movimientoActual: Movimiento;
  movimientoFecha: string | null;
  fechaIngreso: string;
  vinculo: Vinculo | null;
}

export interface Familiar {
  id: string;
  parentesco: string;
  nombresApellidos: string;
  numeroDoc: string | null;
  fechaNacimiento: string | null;
}

export interface TrabajadorDetalle extends TrabajadorResumen {
  finContrato: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  estadoCivil: string | null;
  direccion: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  telefono: string | null;
  correo: string | null;
  gradoInstruccion: string | null;
  profesion: string | null;
  condicionProfesion: string | null;
  creadoEn: string;
  vinculos: Vinculo[];
  familiares: Familiar[];
  movimientos: MovimientoLaboral[];
}

export interface MovimientoLaboral {
  id: string;
  tipo: Movimiento;
  fecha: string;
  areaOrigen: ReferenciaCatalogo;
  areaDestino: ReferenciaCatalogo;
  documentoId: string | null;
  observacion: string | null;
  registradoPor: string;
  registradoEn: string;
}

export interface TrabajadorDirectorio extends TrabajadorResumen {
  documentos: number;
}

export interface PaginaTrabajadores {
  items: TrabajadorDirectorio[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface ResumenPersonal {
  total: number;
  activos: number;
  cesados: number;
  rotados: number;
  destacados: number;
  recientes: TrabajadorResumen[];
}

export interface FiltrosPersonal {
  busqueda: string;
  estado: EstadoTrabajador | '';
  movimiento: Movimiento | '';
  areaId: number | null;
  pagina: number;
}

export interface DatosNuevoVinculo {
  regimenId: number;
  tipoPersonal: TipoPersonal;
  cargoId: number;
  areaId: number;
  referencia: string | null;
}

export interface NuevoTrabajador extends DatosNuevoVinculo, Formacion {
  tipoDocIdentidad: TipoDocIdentidad;
  numeroDoc: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  telefono: string | null;
  correo: string | null;
  fechaIngreso: string;
}

export interface FichaTrabajador extends Formacion {
  tipoDocIdentidad: TipoDocIdentidad;
  numeroDoc: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  estadoCivil: string | null;
  direccion: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  telefono: string | null;
  correo: string | null;
  fechaIngreso: string;
}

export interface Situacion {
  estado: EstadoTrabajador;
  movimiento: Movimiento;
  movimientoFecha: string | null;
  areaOrigenId: number | null;
  areaDestinoId: number | null;
  motivoCese: MotivoCese | null;
  fechaCese: string | null;
  observacion: string | null;
}

export interface ConfirmacionMovimiento {
  tipo: Exclude<Movimiento, 'SIN_MOVIMIENTO'>;
  fecha: string;
  areaOrigenId: number;
  areaDestinoId: number;
  observacion: string | null;
}

export interface ConfirmacionCese {
  motivo: MotivoCese;
  fecha: string;
  observacion: string | null;
}

export interface CambioHistorial {
  campo: string;
  antes: string | null;
  despues: string | null;
}

export interface EntradaHistorial {
  fecha: string;
  evento: string;
  usuario: string | null;
  motivo: string | null;
  cambios: CambioHistorial[];
}

export interface DatosFamiliar {
  parentesco: string;
  nombresApellidos: string;
  numeroDoc: string | null;
  fechaNacimiento: string | null;
}

export type NivelAcceso = 'NORMAL' | 'RESTRINGIDO' | 'MUY_RESTRINGIDO';
export type EstadoDocumento = 'PROCESANDO' | 'DISPONIBLE' | 'ERROR' | 'ANULADO';
export type ValorCampo = string | number | null;

export interface VersionArchivo {
  version: number;
  nombreOriginal: string;
  paginas: number;
  tamanoOriginal: number;
  tamanoFinal: number;
  optimizado: boolean;
  subidoPor: string;
  creadoEn: string;
  actual: boolean;
}

export interface Documento {
  id: string;
  seccion: number;
  tipo: TipoDocumento;
  numero: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  emisor: string | null;
  observaciones: string | null;
  ubicacionFisica: string | null;
  datos: Record<string, ValorCampo>;
  nivelAcceso: NivelAcceso;
  estado: EstadoDocumento;
  detalleError: string | null;
  motivoAnulacion: string | null;
  creadoPor: string;
  creadoEn: string;
  modificadoPor: string | null;
  modificadoEn: string | null;
  motivoModificacion: string | null;
  reintentable: boolean;
  editable: boolean;
  versiones: VersionArchivo[];
  vinculoId: string | null;
  confirmadoPor: string | null;
  confirmadoEn: string | null;
  movimientoId: string | null;
}

export interface SeccionLegajo {
  id: number;
  numero: number;
  nombre: string;
  descripcion: string;
  campos: CampoSeccion[];
  tipos: TipoDocumento[];
  total: number;
  restringida: boolean;
}

export interface Legajo {
  secciones: SeccionLegajo[];
  documentos: Documento[];
}

export interface DatosDocumento {
  tipoDocumentoId: number;
  numero: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  emisor: string | null;
  observaciones: string | null;
  ubicacionFisica: string | null;
  nivelAcceso: NivelAcceso;
  datos: Record<string, ValorCampo>;
}

export type EstadoLote = 'SUBIENDO' | 'EN_BANDEJA' | 'TERMINADO';
export type EstadoItemLote = 'SUBIENDO' | 'PENDIENTE' | 'CLASIFICADO' | 'DIVIDIDO' | 'ERROR';

export interface TrabajadorLote {
  id: string;
  numeroDoc: string;
  nombre: string;
}

export interface TipoLote {
  id: number;
  codigo: string;
  nombre: string;
  seccion: number;
}

export interface VistaPreviaArchivo {
  nombre: string;
  reconocido: boolean;
  motivo: string | null;
  trabajador: TrabajadorLote | null;
  tipo: TipoLote | null;
  numero: string | null;
  fechaEmision: string | null;
}

export interface DocumentoLote {
  id: string;
  estado: EstadoDocumento;
  seccion: number;
  trabajadorId: string;
}

export interface ItemLote {
  id: string;
  orden: number;
  nombreArchivo: string;
  tamano: number;
  estado: EstadoItemLote;
  motivo: string | null;
  trabajador: TrabajadorLote | null;
  tipo: TipoLote | null;
  documentos: DocumentoLote[];
}

export interface Lote {
  id: string;
  estado: EstadoLote;
  total: number;
  clasificados: number;
  pendientes: number;
  conError: number;
  creadoPor: string;
  creadoEn: string;
  terminadoEn: string | null;
  propio: boolean;
}

export interface LoteDetalle extends Lote {
  items: ItemLote[];
}

export interface ArchivoLote {
  nombre: string;
  tamano: number;
}

export interface ParteDivision extends DatosDocumento {
  trabajadorId: string;
  desde: number;
  hasta: number;
}

export type ClaseBusqueda = 'IDENTIDAD' | 'NUMERO' | 'NOMBRE';

export interface TrabajadorRapido {
  id: string;
  numeroDoc: string;
  nombre: string;
  cargo: string | null;
  area: string | null;
  estado: EstadoTrabajador;
}

export interface DocumentoRapido {
  id: string;
  trabajadorId: string;
  trabajador: string;
  seccion: number;
  tipo: string;
  numero: string | null;
  fechaEmision: string | null;
}

export interface ResultadoRapido {
  trabajadores: TrabajadorRapido[];
  documentos: DocumentoRapido[];
}

export interface TrabajadorEncontrado {
  trabajador: TrabajadorResumen;
  documentos: number;
}

export interface DocumentoEncontrado {
  documento: Documento;
  trabajadorId: string;
  trabajador: string;
  numeroDoc: string;
}

export interface GrupoResultados<T> {
  items: T[];
  total: number;
}

export interface ResultadoBusqueda {
  clase: ClaseBusqueda | null;
  pagina: number;
  porPagina: number;
  trabajadores: GrupoResultados<TrabajadorEncontrado>;
  documentos: GrupoResultados<DocumentoEncontrado>;
}

export interface FiltrosBusqueda {
  texto: string;
  seccion: number | null;
  tipoDocumentoId: number | null;
  desde: string;
  hasta: string;
  areaId: number | null;
  regimenId: number | null;
  tipoPersonal: TipoPersonal | null;
  estado: EstadoTrabajador | null;
  estadoDocumento: EstadoDocumento | 'TODOS' | null;
  trabajadorId: string | null;
}

export type SituacionRequisito = 'COMPLETO' | 'FALTANTE' | 'VENCIDO';
export type SituacionCelda = SituacionRequisito | 'NO_APLICA';

export interface FilaPersonal {
  id: string;
  numeroDoc: string;
  nombre: string;
  regimen: string | null;
  tipoPersonal: TipoPersonal | null;
  cargo: string | null;
  area: string | null;
  fechaIngreso: string;
  estado: EstadoTrabajador;
  requisitos: number;
  completos: number;
  vencidos: number;
  faltantes: number;
  completitud: number;
}

export interface ReportePersonal {
  items: FilaPersonal[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface FiltrosReportePersonal {
  areaId: number | null;
  regimenId: number | null;
  tipoPersonal: TipoPersonal | null;
  estado: EstadoTrabajador | null;
  cargoId: number | null;
  ingresoDesde: string;
  ingresoHasta: string;
}

export interface RequisitoTrabajador {
  tipoId: number;
  codigo: string;
  tipo: string;
  seccion: number;
  situacion: SituacionRequisito;
  documentoId: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
}

export interface FaltantesTrabajador {
  trabajadorId: string;
  numeroDoc: string;
  nombre: string;
  requisitos: number;
  completos: number;
  vencidos: number;
  faltantes: number;
  completitud: number;
  items: RequisitoTrabajador[];
}

export interface ColumnaConsolidado {
  tipoId: number;
  codigo: string;
  nombre: string;
  seccion: number;
}

export interface FilaConsolidado {
  id: string;
  numeroDoc: string;
  nombre: string;
  area: string | null;
  celdas: SituacionCelda[];
  requisitos: number;
  completos: number;
  faltantes: number;
  vencidos: number;
}

export interface ReporteConsolidado {
  columnas: ColumnaConsolidado[];
  items: FilaConsolidado[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface FiltrosAvance {
  areaId: number | null;
  regimenId: number | null;
  tipoPersonal: TipoPersonal | null;
  estado: EstadoTrabajador | null;
}

export interface FiltrosConsolidado extends FiltrosAvance {
  soloIncompletos: boolean;
}

export interface FilaVencimiento {
  documentoId: string;
  trabajadorId: string;
  numeroDoc: string;
  trabajador: string;
  estado: EstadoTrabajador;
  area: string | null;
  seccion: number;
  codigo: string;
  tipo: string;
  numero: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string;
  dias: number;
}

export interface ReporteVencimientos {
  items: FilaVencimiento[];
  dias: number;
  vencidos: number;
  porVencer: number;
  conFecha: number;
  sinFecha: number;
}

export interface FiltrosVencimientos {
  dias: number;
  areaId: number | null;
  tipoDocumentoId: number | null;
}

export interface FilaDigitalizacion {
  usuario: string;
  dia: string;
  documentos: number;
  folios: number;
  tamano: number;
}

export interface UsuarioDigitalizacion {
  id: string;
  nombre: string;
}

export interface ReporteDigitalizacion {
  items: FilaDigitalizacion[];
  usuarios: UsuarioDigitalizacion[];
  documentos: number;
  folios: number;
  tamano: number;
}

export interface FiltrosDigitalizacion {
  usuarioId: string | null;
  desde: string;
  hasta: string;
}

export interface FilaAvance {
  area: string;
  trabajadores: number;
  completos: number;
  parciales: number;
  vacios: number;
  completitud: number;
}

export interface ReporteAvance {
  items: FilaAvance[];
  totales: FilaAvance;
}

export interface UsuarioAuditoria {
  id: string;
  usuario: string;
  nombre: string;
}

export interface TrabajadorAuditoria {
  id: string;
  numeroDoc: string;
  nombre: string;
}

export interface EntradaAuditoria {
  id: string;
  fecha: string;
  usuario: UsuarioAuditoria | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  trabajador: TrabajadorAuditoria | null;
  ip: string | null;
  navegador: string | null;
  detalle: string | null;
}

export interface PaginaAuditoria {
  items: EntradaAuditoria[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface OpcionesAuditoria {
  acciones: string[];
  usuarios: UsuarioAuditoria[];
}

export interface FiltrosAuditoria {
  usuarioId: string;
  accion: string;
  numeroDoc: string;
  trabajadorId: string;
  desde: string;
  hasta: string;
}

export type EstadoRespaldo = 'EN_CURSO' | 'CORRECTO' | 'ERROR';

export interface EjecucionRespaldo {
  id: string;
  origen: 'PROGRAMADO' | 'MANUAL';
  usuario: string | null;
  inicio: string;
  fin: string | null;
  estado: EstadoRespaldo;
  snapshotBd: string | null;
  snapshotArchivos: string | null;
  bytesAgregados: number | null;
  verificado: boolean | null;
  error: string | null;
}

export interface EstadoRespaldos {
  configurado: boolean;
  pendiente: boolean;
  ultima: EjecucionRespaldo | null;
  ultimaCorrecta: EjecucionRespaldo | null;
}

export interface CopiaGuardada {
  id: string;
  fecha: string;
  contenido: 'bd' | 'archivos' | 'otro';
  ejecucionId: string | null;
}

export interface PanelRespaldos extends EstadoRespaldos {
  repositorio: { actualizado: string; espacio: number; snapshots: CopiaGuardada[] } | null;
  historial: EjecucionRespaldo[];
  total: number;
  pagina: number;
  porPagina: number;
}

export type TipoReporteGeneral = 'general' | 'situacion' | 'regimen' | 'documentos' | 'secciones' | 'estadisticas';

export interface FiltrosReporteGeneral {
  tipo: TipoReporteGeneral;
  estado: EstadoTrabajador | '';
  areaId: number | null;
  regimenId: number | null;
  busqueda: string;
  ingresoDesde: string;
  ingresoHasta: string;
}

export interface ReporteGeneral {
  tipo: TipoReporteGeneral;
  columnas: string[];
  filas: (string | number | null)[][];
  total: number;
  resumen: { trabajadores: number; documentos: number; pdf: number };
}

export interface CifraIndicador {
  nombre: string;
  cantidad: number;
}

export interface Indicadores {
  trabajadores: number;
  activos: number;
  cesados: number;
  documentos: number;
  pdf: number;
  porSeccion: CifraIndicador[];
  porRegimen: CifraIndicador[];
}

export interface FilaImportacion {
  fila: number;
  tipoDocIdentidad: TipoDocIdentidad;
  numeroDoc: string;
  sexo: 'M' | 'F' | null;
  fechaNacimiento: string | null;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  tipoPersonal: TipoPersonal;
  regimen: string;
  area: string;
  cargo: string;
  estado: EstadoTrabajador;
  fechaIngreso: string;
  motivoCese: MotivoCese | null;
  fechaCese: string | null;
  gradoInstruccion: string | null;
  profesion: string | null;
  condicionProfesion: string | null;
  avisos: string[];
}

export interface FormacionImportacion extends Formacion {
  tipoDocIdentidad: TipoDocIdentidad;
  numeroDoc: string;
  gradoInstruccion: string;
}

export interface VistaImportacion {
  validos: FilaImportacion[];
  completar: FormacionImportacion[];
  observaciones: string[];
  total: number;
}

export interface ResultadoImportacion {
  importados: number;
  completados: number;
  catalogosCreados: number;
}

export interface PermisoRolSeccion {
  id: string;
  nombre: string;
  bloqueado: boolean;
  restringidas: number[];
}

export interface PermisosSeccion {
  secciones: { numero: number; nombre: string }[];
  roles: PermisoRolSeccion[];
}
