import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsUUID, Matches, Min } from 'class-validator';

const vacioANulo = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const limpio = value.trim();
  return limpio === '' ? null : limpio;
};
const fechaMensaje = { message: 'Usa una fecha válida (AAAA-MM-DD)' };

export class AuditFiltersDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsUUID('4', { message: 'Elige un usuario de la lista' })
  usuarioId?: string | null = null;

  @ApiPropertyOptional()
  @Transform(vacioANulo)
  @IsOptional()
  @Matches(/^[A-Z_]{2,60}$/, { message: 'Elige una acción de la lista' })
  accion?: string | null = null;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsUUID('4', { message: 'Trabajador no válido' })
  trabajadorId?: string | null = null;

  @ApiPropertyOptional({ description: 'Número de documento de identidad del trabajador' })
  @Transform(vacioANulo)
  @IsOptional()
  @Matches(/^[0-9A-Za-z]{6,12}$/, { message: 'Escribe un número de documento válido' })
  numeroDoc?: string | null = null;

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

export class AuditQueryDto extends AuditFiltersDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;
}
