import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DocumentFieldsDto } from '../../documents/dto/document-input.dto';

export const MAXIMO_ARCHIVOS = 500;
const MAXIMO_BYTES = 200 * 1024 * 1024;
const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

export class PreviewBatchDto {
  @ApiProperty({ type: [String], maxItems: MAXIMO_ARCHIVOS })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos un archivo' })
  @ArrayMaxSize(MAXIMO_ARCHIVOS, { message: `Un lote admite hasta ${MAXIMO_ARCHIVOS} archivos` })
  @IsString({ each: true })
  @Length(1, 255, { each: true })
  nombres: string[];
}

export class BatchFileDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @Length(5, 255)
  @Matches(/\.pdf$/i, { message: 'Solo se aceptan archivos PDF' })
  nombre: string;

  @ApiProperty()
  @IsInt()
  @Min(1, { message: 'Hay un archivo vacío' })
  @Max(MAXIMO_BYTES, { message: 'Hay un archivo de más de 200 MB' })
  tamano: number;
}

export class CreateBatchDto {
  @ApiProperty({ type: [BatchFileDto], maxItems: MAXIMO_ARCHIVOS })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos un archivo' })
  @ArrayMaxSize(MAXIMO_ARCHIVOS, { message: `Un lote admite hasta ${MAXIMO_ARCHIVOS} archivos` })
  @ValidateNested({ each: true })
  @Type(() => BatchFileDto)
  archivos: BatchFileDto[];
}

export class UploadedItemDto {
  @ApiProperty()
  @Matches(/^[a-f0-9]{32}$/, { message: 'La subida no es válida' })
  subidaId: string;
}

export class ClassifyItemDto extends DocumentFieldsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Elige el trabajador' })
  trabajadorId: string;
}

export class SplitPartDto extends ClassifyItemDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  desde: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  hasta: number;
}

export class SplitItemDto {
  @ApiProperty({ type: [SplitPartDto], minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1, { message: 'Indica al menos un rango de páginas' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SplitPartDto)
  partes: SplitPartDto[];
}

export class DiscardItemDto {
  @ApiProperty({ minLength: 5, maxLength: 300 })
  @Transform(recortar)
  @IsString({ message: 'Indica el motivo' })
  @Length(5, 300, { message: 'Indica el motivo (mínimo 5 caracteres)' })
  motivo: string;
}

export class DeleteItemDto {
  @ApiProperty({ minLength: 10, maxLength: 300 })
  @Transform(recortar)
  @IsString({ message: 'Indica el motivo' })
  @Length(10, 300, { message: 'Indica el motivo de la eliminación (mínimo 10 caracteres)' })
  motivo: string;

  @ApiProperty({ minLength: 1, maxLength: 200, description: 'Contraseña del usuario que elimina' })
  @IsString({ message: 'Ingresa tu contraseña' })
  @Length(1, 200, { message: 'Ingresa tu contraseña' })
  clave: string;
}
