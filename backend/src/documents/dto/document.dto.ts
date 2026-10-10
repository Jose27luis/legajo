import { ApiProperty } from '@nestjs/swagger';
import { DocumentTypeDto, SectionFieldDto } from '../../catalogs/dto/catalog.dto';

export const NIVELES_ACCESO = ['NORMAL', 'RESTRINGIDO', 'MUY_RESTRINGIDO'] as const;
export const ESTADOS_DOCUMENTO = ['PROCESANDO', 'DISPONIBLE', 'ERROR', 'ANULADO'] as const;

export type NivelAccesoValor = (typeof NIVELES_ACCESO)[number];
export type EstadoDocumentoValor = (typeof ESTADOS_DOCUMENTO)[number];

export class FileVersionDto {
  @ApiProperty()
  version: number;

  @ApiProperty()
  nombreOriginal: string;

  @ApiProperty()
  paginas: number;

  @ApiProperty()
  tamanoOriginal: number;

  @ApiProperty()
  tamanoFinal: number;

  @ApiProperty()
  optimizado: boolean;

  @ApiProperty()
  subidoPor: string;

  @ApiProperty({ format: 'date-time' })
  creadoEn: string;

  @ApiProperty()
  actual: boolean;
}

export class DocumentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  seccion: number;

  @ApiProperty({ type: DocumentTypeDto })
  tipo: DocumentTypeDto;

  @ApiProperty({ type: String, nullable: true })
  numero: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  fechaEmision: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  fechaVencimiento: string | null;

  @ApiProperty({ type: String, nullable: true })
  emisor: string | null;

  @ApiProperty({ type: String, nullable: true })
  observaciones: string | null;

  @ApiProperty({ type: String, nullable: true })
  ubicacionFisica: string | null;

  @ApiProperty({ type: 'object', additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }] } })
  datos: Record<string, string | number | null>;

  @ApiProperty({ enum: NIVELES_ACCESO })
  nivelAcceso: NivelAccesoValor;

  @ApiProperty({ enum: ESTADOS_DOCUMENTO })
  estado: EstadoDocumentoValor;

  @ApiProperty({ type: String, nullable: true })
  detalleError: string | null;

  @ApiProperty({ type: String, nullable: true })
  motivoAnulacion: string | null;

  @ApiProperty()
  creadoPor: string;

  @ApiProperty({ format: 'date-time' })
  creadoEn: string;

  @ApiProperty({ type: String, nullable: true })
  modificadoPor: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  modificadoEn: string | null;

  @ApiProperty({ type: String, nullable: true })
  motivoModificacion: string | null;

  @ApiProperty()
  reintentable: boolean;

  @ApiProperty()
  editable: boolean;

  @ApiProperty({ type: [FileVersionDto] })
  versiones: FileVersionDto[];
}

export class LegajoSectionDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  numero: number;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  descripcion: string;

  @ApiProperty({ type: [SectionFieldDto] })
  campos: SectionFieldDto[];

  @ApiProperty({ type: [DocumentTypeDto] })
  tipos: DocumentTypeDto[];

  @ApiProperty()
  total: number;
}

export class LegajoDto {
  @ApiProperty({ type: [LegajoSectionDto] })
  secciones: LegajoSectionDto[];

  @ApiProperty({ type: [DocumentDto] })
  documentos: DocumentDto[];
}
