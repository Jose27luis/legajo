import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsString, Length, Matches, Max, Min } from 'class-validator';
import { APLICA_A, TIPOS_PERSONAL, type AplicaAValor, type TipoPersonalValor } from './catalog.dto';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const mayusculas = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class DocumentTypeFieldsDto {
  @ApiProperty({ minLength: 3, maxLength: 200 })
  @Transform(recortar)
  @IsString({ message: 'Ingresa el nombre del tipo' })
  @Length(3, 200, { message: 'El nombre debe tener entre 3 y 200 caracteres' })
  nombre: string;

  @ApiProperty()
  @IsBoolean()
  restringido: boolean;

  @ApiProperty()
  @IsBoolean()
  requiereNumero: boolean;

  @ApiProperty()
  @IsBoolean()
  tieneVencimiento: boolean;
}

export class CreateDocumentTypeDto extends DocumentTypeFieldsDto {
  @ApiProperty()
  @IsInt({ message: 'Selecciona una sección' })
  @IsPositive({ message: 'Selecciona una sección' })
  seccionId: number;
}

export class UpdateDocumentTypeDto extends DocumentTypeFieldsDto {
  @ApiProperty()
  @IsBoolean()
  activo: boolean;

  @ApiProperty({ minimum: 0, maximum: 999 })
  @IsInt()
  @Min(0)
  @Max(999)
  orden: number;
}

export class CreateRequirementDto {
  @ApiProperty()
  @IsInt({ message: 'Selecciona el tipo de documento' })
  @IsPositive({ message: 'Selecciona el tipo de documento' })
  tipoDocumentoId: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Nulo para todos los regímenes' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  regimenId: number | null;

  @ApiProperty({ enum: TIPOS_PERSONAL, nullable: true, description: 'Nulo para ambos tipos de personal' })
  @IsOptional()
  @IsIn(TIPOS_PERSONAL, { message: 'Tipo de personal no válido' })
  tipoPersonal: TipoPersonalValor | null;

  @ApiProperty({ enum: APLICA_A })
  @IsIn(APLICA_A, { message: 'Indica a qué trabajadores aplica' })
  aplicaA: AplicaAValor;
}

export class UpdateRegimeDto {
  @ApiProperty({ minLength: 2, maxLength: 80 })
  @Transform(recortar)
  @IsString({ message: 'Ingresa el nombre del régimen' })
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  nombre: string;

  @ApiProperty()
  @IsBoolean()
  esLaboral: boolean;

  @ApiProperty()
  @IsBoolean()
  activo: boolean;
}

export class CreateRegimeDto extends UpdateRegimeDto {
  @ApiProperty({ example: 'DL1057' })
  @Transform(mayusculas)
  @IsString({ message: 'Ingresa el código' })
  @Matches(/^[A-Z0-9_]{2,20}$/, { message: 'El código debe tener de 2 a 20 letras, números o guion bajo' })
  codigo: string;
}

export class AreaInputDto {
  @ApiProperty({ minLength: 2, maxLength: 140 })
  @Transform(recortar)
  @IsString({ message: 'Ingresa el nombre del área' })
  @Length(2, 140, { message: 'El nombre debe tener entre 2 y 140 caracteres' })
  nombre: string;

  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @IsPositive()
  padreId: number | null;

  @ApiProperty()
  @IsBoolean()
  activo: boolean;
}

export class PositionInputDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @Transform(recortar)
  @IsString({ message: 'Ingresa el nombre del cargo' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres' })
  nombre: string;

  @ApiProperty()
  @IsBoolean()
  activo: boolean;
}
