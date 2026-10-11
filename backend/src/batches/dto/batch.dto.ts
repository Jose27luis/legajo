import { ApiProperty } from '@nestjs/swagger';

export const ESTADOS_LOTE = ['SUBIENDO', 'EN_BANDEJA', 'TERMINADO'] as const;
export const ESTADOS_ITEM = ['SUBIENDO', 'PENDIENTE', 'CLASIFICADO', 'DIVIDIDO', 'ERROR'] as const;

export class BatchWorkerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  numeroDoc: string;

  @ApiProperty()
  nombre: string;
}

export class BatchTypeDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  seccion: number;
}

export class PreviewItemDto {
  @ApiProperty()
  nombre: string;

  @ApiProperty()
  reconocido: boolean;

  @ApiProperty({ type: String, nullable: true })
  motivo: string | null;

  @ApiProperty({ type: BatchWorkerDto, nullable: true })
  trabajador: BatchWorkerDto | null;

  @ApiProperty({ type: BatchTypeDto, nullable: true })
  tipo: BatchTypeDto | null;

  @ApiProperty({ type: String, nullable: true })
  numero: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  fechaEmision: string | null;
}

export class BatchDocumentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  estado: string;

  @ApiProperty()
  seccion: number;

  @ApiProperty({ format: 'uuid' })
  trabajadorId: string;
}

export class BatchItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  orden: number;

  @ApiProperty()
  nombreArchivo: string;

  @ApiProperty()
  tamano: number;

  @ApiProperty({ enum: ESTADOS_ITEM })
  estado: (typeof ESTADOS_ITEM)[number];

  @ApiProperty({ type: String, nullable: true })
  motivo: string | null;

  @ApiProperty({ type: BatchWorkerDto, nullable: true })
  trabajador: BatchWorkerDto | null;

  @ApiProperty({ type: BatchTypeDto, nullable: true })
  tipo: BatchTypeDto | null;

  @ApiProperty({ type: [BatchDocumentDto] })
  documentos: BatchDocumentDto[];
}

export class BatchDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ESTADOS_LOTE })
  estado: (typeof ESTADOS_LOTE)[number];

  @ApiProperty()
  total: number;

  @ApiProperty()
  clasificados: number;

  @ApiProperty()
  pendientes: number;

  @ApiProperty()
  conError: number;

  @ApiProperty()
  creadoPor: string;

  @ApiProperty({ format: 'date-time' })
  creadoEn: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  terminadoEn: string | null;

  @ApiProperty()
  propio: boolean;
}

export class BatchDetailDto extends BatchDto {
  @ApiProperty({ type: [BatchItemDto] })
  items: BatchItemDto[];
}
