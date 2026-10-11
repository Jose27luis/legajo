import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsPositive, IsUUID, Max, Min } from 'class-validator';
import { ESTADOS, TIPOS_PERSONAL, type EstadoValor, type TipoPersonalValor } from '../../workers/dto/worker.dto';

const vacioANulo = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const limpio = value.trim();
  return limpio === '' ? null : limpio;
};
const aBooleano = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';
const fechaMensaje = { message: 'Usa una fecha válida (AAAA-MM-DD)' };

export const MAXIMO_DIAS = 365;

class FiltrosPersonal {
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
}

export class StaffReportQueryDto extends FiltrosPersonal {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cargoId?: number;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  ingresoDesde?: string | null = null;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  ingresoHasta?: string | null = null;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;
}

export class MissingSummaryQueryDto extends FiltrosPersonal {
  @ApiPropertyOptional({ description: 'Deja solo a los trabajadores con faltantes o vencidos' })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  soloIncompletos?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;
}

export class ProgressQueryDto extends FiltrosPersonal {}

export class ExpiringQueryDto {
  @ApiPropertyOptional({ default: 30, maximum: MAXIMO_DIAS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAXIMO_DIAS)
  dias?: number;

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
  tipoDocumentoId?: number;
}

export class DigitizationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsUUID('4')
  usuarioId?: string | null = null;

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
}
