import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsPositive, IsString, IsUUID, Length, Matches } from 'class-validator';
import { NIVELES_ACCESO, type NivelAccesoValor } from './document.dto';

const vacioANulo = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const limpio = value.trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
};
const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const fechaMensaje = { message: 'Usa una fecha válida (AAAA-MM-DD)' };
const SUBIDA = /^[a-f0-9]{32}$/;

export class DocumentFieldsDto {
  @ApiProperty()
  @IsInt({ message: 'Selecciona el tipo de documento' })
  @IsPositive({ message: 'Selecciona el tipo de documento' })
  tipoDocumentoId: number;

  @ApiPropertyOptional({ maxLength: 60 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 60)
  numero: string | null = null;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  fechaEmision: string | null = null;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  fechaVencimiento: string | null = null;

  @ApiPropertyOptional({ maxLength: 160 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 160)
  emisor: string | null = null;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 500)
  observaciones: string | null = null;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  ubicacionFisica: string | null = null;

  @ApiProperty({ enum: NIVELES_ACCESO })
  @IsIn(NIVELES_ACCESO, { message: 'Nivel de acceso no válido' })
  nivelAcceso: NivelAccesoValor = 'NORMAL';

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Campos propios de la sección' })
  @IsObject()
  datos: Record<string, unknown> = {};
}

export class CreateDocumentDto extends DocumentFieldsDto {
  @ApiProperty({ description: 'Identificador de la subida tus completada' })
  @Matches(SUBIDA, { message: 'La subida no es válida' })
  subidaId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Vínculo del historial que sustenta el documento' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsUUID('4', { message: 'El vínculo no es válido' })
  vinculoId: string | null = null;
}

export class UpdateDocumentDto extends DocumentFieldsDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Transform(recortar)
  @IsString({ message: 'Explica qué se corrigió' })
  @Length(5, 500, { message: 'Explica qué se corrigió (mínimo 5 caracteres)' })
  motivo: string;
}

export class VoidDocumentDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Transform(recortar)
  @IsString({ message: 'Indica el motivo' })
  @Length(5, 500, { message: 'Indica el motivo (mínimo 5 caracteres)' })
  motivo: string;
}

export class DeleteDocumentDto {
  @ApiProperty({ minLength: 10, maxLength: 500 })
  @Transform(recortar)
  @IsString({ message: 'Indica el motivo' })
  @Length(10, 500, { message: 'Indica el motivo de la eliminación (mínimo 10 caracteres)' })
  motivo: string;
}

export class ReplaceDocumentDto extends VoidDocumentDto {
  @ApiProperty()
  @Matches(SUBIDA, { message: 'La subida no es válida' })
  subidaId: string;
}
