import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export const ORIGENES = ['PROGRAMADO', 'MANUAL'] as const;
export const ESTADOS_BACKUP = ['EN_CURSO', 'CORRECTO', 'ERROR'] as const;

export class BackupQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;
}

export class BackupRunDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ORIGENES })
  origen: (typeof ORIGENES)[number];

  @ApiProperty({ type: String, nullable: true })
  usuario: string | null;

  @ApiProperty({ format: 'date-time' })
  inicio: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  fin: string | null;

  @ApiProperty({ enum: ESTADOS_BACKUP })
  estado: (typeof ESTADOS_BACKUP)[number];

  @ApiProperty({ type: String, nullable: true })
  snapshotBd: string | null;

  @ApiProperty({ type: String, nullable: true })
  snapshotArchivos: string | null;

  @ApiProperty({ type: Number, nullable: true })
  bytesAgregados: number | null;

  @ApiProperty({ type: Boolean, nullable: true })
  verificado: boolean | null;

  @ApiProperty({ type: String, nullable: true })
  error: string | null;
}

export class BackupStatusDto {
  @ApiProperty({ description: 'La clave de las copias está configurada en el servidor' })
  configurado: boolean;

  @ApiProperty({ description: 'Hay una copia en curso o esperando turno' })
  pendiente: boolean;

  @ApiProperty({ type: BackupRunDto, nullable: true })
  ultima: BackupRunDto | null;

  @ApiProperty({ type: BackupRunDto, nullable: true })
  ultimaCorrecta: BackupRunDto | null;
}

export class SnapshotDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ format: 'date-time' })
  fecha: string;

  @ApiProperty({ enum: ['bd', 'archivos', 'otro'] })
  contenido: 'bd' | 'archivos' | 'otro';

  @ApiProperty({ type: String, nullable: true })
  ejecucionId: string | null;
}

export class RepositoryDto {
  @ApiProperty({ format: 'date-time' })
  actualizado: string;

  @ApiProperty()
  espacio: number;

  @ApiProperty({ type: [SnapshotDto] })
  snapshots: SnapshotDto[];
}

export class BackupPanelDto extends BackupStatusDto {
  @ApiProperty({ type: RepositoryDto, nullable: true })
  repositorio: RepositoryDto | null;

  @ApiProperty({ type: [BackupRunDto] })
  historial: BackupRunDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  porPagina: number;
}
