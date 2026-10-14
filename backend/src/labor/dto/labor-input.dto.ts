import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsPositive, IsString, Length } from 'class-validator';
import { MOTIVOS_CESE, MOVIMIENTOS, type MotivoCeseValor, type MovimientoValor } from '../../workers/dto/worker.dto';

const vacioANulo = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const limpio = value.trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
};
const fechaMensaje = { message: 'Usa una fecha válida (AAAA-MM-DD)' };
export const MOVIMIENTOS_REALES = MOVIMIENTOS.filter((movimiento) => movimiento !== 'SIN_MOVIMIENTO');

class ConObservacion {
  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 500)
  observacion: string | null = null;
}

export class MovementInputDto extends ConObservacion {
  @ApiProperty({ enum: MOVIMIENTOS_REALES })
  @IsIn(MOVIMIENTOS_REALES, { message: 'Elige el tipo de movimiento' })
  tipo: Exclude<MovimientoValor, 'SIN_MOVIMIENTO'>;

  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true }, fechaMensaje)
  fecha: string;

  @ApiProperty()
  @IsInt({ message: 'Elige el área de origen' })
  @IsPositive({ message: 'Elige el área de origen' })
  areaOrigenId: number;

  @ApiProperty()
  @IsInt({ message: 'Elige el área de destino' })
  @IsPositive({ message: 'Elige el área de destino' })
  areaDestinoId: number;
}

export class CeseInputDto extends ConObservacion {
  @ApiProperty({ enum: MOTIVOS_CESE })
  @IsIn(MOTIVOS_CESE, { message: 'Elige el motivo del cese' })
  motivo: MotivoCeseValor;

  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true }, fechaMensaje)
  fecha: string;
}
