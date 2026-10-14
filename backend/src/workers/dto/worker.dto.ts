import { ApiProperty } from '@nestjs/swagger';

export const TIPOS_DOC = ['DNI', 'CE'] as const;
export const ESTADOS = ['ACTIVO', 'CESADO'] as const;
export const MOVIMIENTOS = [
  'SIN_MOVIMIENTO',
  'ROTACION',
  'DESTAQUE',
  'ENCARGATURA',
  'REASIGNACION',
  'DESIGNACION',
  'CAMBIO_FUNCIONES',
  'OTRO',
] as const;
export const MOTIVOS_CESE = ['RENUNCIA', 'JUBILACION', 'FALLECIMIENTO', 'FIN_CONTRATO', 'DESTITUCION', 'OTRA_CAUSA'] as const;
export const MOTIVOS_CAMBIO = ['RENOVACION', 'CAMBIO_REGIMEN', 'CAMBIO_CARGO_O_AREA'] as const;
export const MOTIVOS_FIN = [...MOTIVOS_CESE, ...MOTIVOS_CAMBIO] as const;
export const TIPOS_PERSONAL = ['ADMINISTRATIVO', 'ASISTENCIAL'] as const;

export type TipoDocValor = (typeof TIPOS_DOC)[number];
export type EstadoValor = (typeof ESTADOS)[number];
export type MovimientoValor = (typeof MOVIMIENTOS)[number];
export type MotivoCeseValor = (typeof MOTIVOS_CESE)[number];
export type MotivoCambioValor = (typeof MOTIVOS_CAMBIO)[number];
export type MotivoFinValor = (typeof MOTIVOS_FIN)[number];
export type TipoPersonalValor = (typeof TIPOS_PERSONAL)[number];

export class CatalogRefDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombre: string;
}

export class LinkDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: CatalogRefDto })
  regimen: CatalogRefDto;

  @ApiProperty({ enum: TIPOS_PERSONAL })
  tipoPersonal: TipoPersonalValor;

  @ApiProperty({ type: CatalogRefDto })
  cargo: CatalogRefDto;

  @ApiProperty({ type: CatalogRefDto })
  area: CatalogRefDto;

  @ApiProperty({ format: 'date' })
  fechaInicio: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  fechaFin: string | null;

  @ApiProperty({ enum: MOTIVOS_FIN, nullable: true })
  motivoFin: MotivoFinValor | null;

  @ApiProperty({ type: String, nullable: true })
  referencia: string | null;

  @ApiProperty()
  actual: boolean;
}

export class WorkerListItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TIPOS_DOC })
  tipoDocIdentidad: TipoDocValor;

  @ApiProperty()
  numeroDoc: string;

  @ApiProperty()
  nombres: string;

  @ApiProperty()
  apellidoPaterno: string;

  @ApiProperty({ type: String, nullable: true })
  apellidoMaterno: string | null;

  @ApiProperty({ enum: ESTADOS })
  estado: EstadoValor;

  @ApiProperty({ enum: MOVIMIENTOS })
  movimientoActual: MovimientoValor;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  movimientoFecha: string | null;

  @ApiProperty({ format: 'date' })
  fechaIngreso: string;

  @ApiProperty({ type: LinkDto, nullable: true })
  vinculo: LinkDto | null;
}

export class WorkerDirectoryItemDto extends WorkerListItemDto {
  @ApiProperty({ description: 'Documentos registrados que la cuenta puede ver' })
  documentos: number;
}

export class WorkerPageDto {
  @ApiProperty({ type: [WorkerDirectoryItemDto] })
  items: WorkerDirectoryItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  porPagina: number;
}

export class WorkerSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  activos: number;

  @ApiProperty()
  cesados: number;

  @ApiProperty()
  rotados: number;

  @ApiProperty()
  destacados: number;

  @ApiProperty({ type: [WorkerListItemDto] })
  recientes: WorkerListItemDto[];
}

export class RelativeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  parentesco: string;

  @ApiProperty()
  nombresApellidos: string;

  @ApiProperty({ type: String, nullable: true })
  numeroDoc: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  fechaNacimiento: string | null;
}

export class WorkerDetailDto extends WorkerListItemDto {
  @ApiProperty({ type: String, format: 'date', nullable: true })
  fechaNacimiento: string | null;

  @ApiProperty({ type: String, nullable: true })
  sexo: string | null;

  @ApiProperty({ type: String, nullable: true })
  estadoCivil: string | null;

  @ApiProperty({ type: String, nullable: true })
  direccion: string | null;

  @ApiProperty({ type: String, nullable: true })
  departamento: string | null;

  @ApiProperty({ type: String, nullable: true })
  provincia: string | null;

  @ApiProperty({ type: String, nullable: true })
  distrito: string | null;

  @ApiProperty({ type: String, nullable: true })
  telefono: string | null;

  @ApiProperty({ type: String, nullable: true })
  correo: string | null;

  @ApiProperty({ format: 'date-time' })
  creadoEn: string;

  @ApiProperty({ type: [LinkDto] })
  vinculos: LinkDto[];

  @ApiProperty({ type: [RelativeDto] })
  familiares: RelativeDto[];

  @ApiProperty({ type: () => [MovementDto], description: 'Movimientos laborales, del más reciente al más antiguo' })
  movimientos: MovementDto[];
}

export class MovementDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: MOVIMIENTOS })
  tipo: MovimientoValor;

  @ApiProperty({ format: 'date' })
  fecha: string;

  @ApiProperty({ type: CatalogRefDto })
  areaOrigen: CatalogRefDto;

  @ApiProperty({ type: CatalogRefDto })
  areaDestino: CatalogRefDto;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Documento de la sección 05 que lo sustenta' })
  documentoId: string | null;

  @ApiProperty({ type: String, nullable: true })
  observacion: string | null;

  @ApiProperty()
  registradoPor: string;

  @ApiProperty({ format: 'date-time' })
  registradoEn: string;
}

export class WorkerLookupDto {
  @ApiProperty()
  existe: boolean;

  @ApiProperty({ type: WorkerListItemDto, nullable: true })
  trabajador: WorkerListItemDto | null;
}
