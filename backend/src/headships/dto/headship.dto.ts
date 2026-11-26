import { ApiProperty } from '@nestjs/swagger';

export const SITUACIONES_ASIGNACION = ['VIGENTE', 'PROXIMA', 'CONCLUIDA'] as const;
export type SituacionAsignacion = (typeof SITUACIONES_ASIGNACION)[number];

export class AssignmentDto {
  @ApiProperty({ format: 'uuid' })
  documentoId: string;

  @ApiProperty({ format: 'uuid' })
  trabajadorId: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  documentoIdentidad: string;

  @ApiProperty()
  trabajadorActivo: boolean;

  @ApiProperty({ type: String, nullable: true })
  tipoAccion: string | null;

  @ApiProperty({ type: String, nullable: true })
  numero: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date' })
  fechaEmision: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date' })
  desde: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date' })
  hasta: string | null;

  @ApiProperty({ enum: SITUACIONES_ASIGNACION })
  situacion: SituacionAsignacion;

  @ApiProperty({ description: 'El PDF ya se puede abrir' })
  disponible: boolean;
}

export class HealthFacilityHeadshipDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ type: Number, nullable: true })
  microredId: number | null;

  @ApiProperty({ type: String, nullable: true })
  microred: string | null;

  @ApiProperty({ description: 'Trabajadores con vínculo actual en el EESS' })
  personal: number;

  @ApiProperty({ type: () => AssignmentDto, nullable: true })
  actual: AssignmentDto | null;

  @ApiProperty({ type: () => [AssignmentDto] })
  historial: AssignmentDto[];
}

export class MicronetworkHeadshipDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  activo: boolean;

  @ApiProperty({ description: 'EESS que dependen de la microred' })
  eess: number;

  @ApiProperty({ type: () => AssignmentDto, nullable: true })
  actual: AssignmentDto | null;

  @ApiProperty({ type: () => [AssignmentDto] })
  historial: AssignmentDto[];
}

export class HeadshipCandidateDto {
  @ApiProperty({ format: 'uuid' })
  trabajadorId: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  documentoIdentidad: string;

  @ApiProperty()
  cargo: string;

  @ApiProperty({ description: 'EESS de su período actual' })
  eess: string;
}

export class BulkRowReviewDto {
  @ApiProperty({ description: 'Posición de la fila en la lista enviada, desde 0' })
  indice: number;

  @ApiProperty({ type: [String] })
  problemas: string[];
}

export class BulkReviewDto {
  @ApiProperty({ type: () => [BulkRowReviewDto] })
  filas: BulkRowReviewDto[];

  @ApiProperty({ description: 'Ninguna fila tiene problemas' })
  valida: boolean;
}

export class BulkResultDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  documentos: string[];
}

export class HeadshipsDto {
  @ApiProperty({ type: () => [HealthFacilityHeadshipDto] })
  eess: HealthFacilityHeadshipDto[];

  @ApiProperty({ type: () => [MicronetworkHeadshipDto] })
  microredes: MicronetworkHeadshipDto[];
}
