import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsPositive, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { ESTADOS_DOCUMENTO, type EstadoDocumentoValor } from '../../documents/dto/document.dto';
import { ESTADOS, TIPOS_PERSONAL, type EstadoValor, type TipoPersonalValor } from '../../workers/dto/worker.dto';

export const MAXIMO_SELECCION = 100;
export const ESTADOS_BUSQUEDA = [...ESTADOS_DOCUMENTO, 'TODOS'] as const;
export const SECCIONES = 12;

const vacioANulo = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const limpio = value.trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
};
const fechaMensaje = { message: 'Usa una fecha válida (AAAA-MM-DD)' };

export class QuickSearchDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @Transform(vacioANulo)
  @IsString({ message: 'Escribe lo que quieres buscar' })
  @Length(2, 120, { message: 'Escribe al menos dos caracteres' })
  texto: string;
}

export class SearchQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(2, 120, { message: 'Escribe al menos dos caracteres' })
  texto?: string | null = null;

  @ApiPropertyOptional({ minimum: 1, maximum: SECCIONES })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SECCIONES)
  seccion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  tipoDocumentoId?: number;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  desde?: string | null = null;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  hasta?: string | null = null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  areaId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  regimenId?: number;

  @ApiPropertyOptional({ enum: TIPOS_PERSONAL })
  @IsOptional()
  @IsIn(TIPOS_PERSONAL)
  tipoPersonal?: TipoPersonalValor;

  @ApiPropertyOptional({ enum: ESTADOS })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: EstadoValor;

  @ApiPropertyOptional({ enum: ESTADOS_BUSQUEDA, description: 'TODOS incluye los anulados y los que tienen error' })
  @IsOptional()
  @IsIn(ESTADOS_BUSQUEDA)
  estadoDocumento?: EstadoDocumentoValor | 'TODOS';

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsUUID('4', { message: 'Trabajador no válido' })
  trabajadorId?: string | null = null;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;
}

export class SelectionZipDto {
  @ApiProperty({ type: [String], format: 'uuid', maxItems: MAXIMO_SELECCION })
  @IsArray()
  @ArrayMinSize(1, { message: 'Marca al menos un documento' })
  @ArrayMaxSize(MAXIMO_SELECCION, { message: `Marca como máximo ${MAXIMO_SELECCION} documentos` })
  @IsUUID('4', { each: true })
  ids: string[];
}
