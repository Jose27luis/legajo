import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { NIVELES_ACCESO, type NivelAccesoValor } from '../../documents/dto/document.dto';
import { CARGOS_JEFATURA, type CargoJefatura } from '../headship-rules';

export const MAXIMO_DESIGNACIONES = 120;

const vacioANulo = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const limpio = value.trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
};
const fechaMensaje = { message: 'Usa una fecha válida (AAAA-MM-DD)' };

export class CandidatesQueryDto {
  @ApiProperty({ description: 'EESS o microred' })
  @Type(() => Number)
  @IsInt({ message: 'Indica el EESS o la microred' })
  @IsPositive({ message: 'Indica el EESS o la microred' })
  areaId: number;
}

export class BulkAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Elige a la persona designada' })
  trabajadorId: string;

  @ApiProperty({ description: 'EESS (para jefes) o microred (para gerentes)' })
  @IsInt({ message: 'Indica la sede' })
  @IsPositive({ message: 'Indica la sede' })
  areaId: number;

  @ApiPropertyOptional({ format: 'date', nullable: true, description: 'Inicio propio; si falta, vale el común' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  desde: string | null = null;

  @ApiPropertyOptional({ format: 'date', nullable: true, description: 'Término propio; si falta, vale el común' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  hasta: string | null = null;
}

export class BulkDesignationDto {
  @ApiProperty({ enum: CARGOS_JEFATURA })
  @IsIn(CARGOS_JEFATURA, { message: 'Elige si son jefes de EESS o gerentes de microred' })
  cargo: CargoJefatura;

  @ApiProperty({ maxLength: 60 })
  @Transform(vacioANulo)
  @IsString({ message: 'Ingresa el número de la resolución' })
  @Length(1, 60, { message: 'Ingresa el número de la resolución' })
  numero: string;

  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true }, { message: 'Ingresa la fecha de emisión (AAAA-MM-DD)' })
  fechaEmision: string;

  @ApiProperty({ description: 'Una de las opciones de «Tipo de acción» de la 0704' })
  @IsString({ message: 'Elige el tipo de acción' })
  @Length(1, 120, { message: 'Elige el tipo de acción' })
  tipoAccion: string;

  @ApiProperty({ format: 'date', description: 'Inicio de funciones común' })
  @IsISO8601({ strict: true }, { message: 'Ingresa el inicio de funciones (AAAA-MM-DD)' })
  desde: string;

  @ApiPropertyOptional({ format: 'date', nullable: true, description: 'Término de funciones común' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  hasta: string | null = null;

  @ApiProperty({ enum: NIVELES_ACCESO })
  @IsIn(NIVELES_ACCESO, { message: 'Nivel de acceso no válido' })
  nivelAcceso: NivelAccesoValor = 'NORMAL';

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 500)
  observaciones: string | null = null;

  @ApiProperty({ type: [BulkAssignmentDto], minItems: 1, maxItems: MAXIMO_DESIGNACIONES })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos una persona' })
  @ArrayMaxSize(MAXIMO_DESIGNACIONES, { message: `Una resolución admite hasta ${MAXIMO_DESIGNACIONES} designaciones` })
  @ValidateNested({ each: true })
  @Type(() => BulkAssignmentDto)
  asignaciones: BulkAssignmentDto[];
}

export class RegisterBulkDesignationDto extends BulkDesignationDto {
  @ApiProperty({ description: 'Identificador de la subida del PDF de la resolución' })
  @Matches(/^[a-f0-9]{32}$/, { message: 'Vuelve a seleccionar el PDF' })
  subidaId: string;
}
