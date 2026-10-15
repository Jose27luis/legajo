import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Matches, Min, ValidateNested } from 'class-validator';
import { ESTADOS, MOTIVOS_CESE, TIPOS_PERSONAL, type EstadoValor, type MotivoCeseValor, type TipoPersonalValor } from './worker.dto';

export const MAXIMO_IMPORTACION = 3000;
export const TIPOS_DOC_IMPORTACION = ['DNI', 'CE'] as const;
export const SEXOS = ['M', 'F'] as const;
export type TipoDocImportacion = (typeof TIPOS_DOC_IMPORTACION)[number];
export type SexoImportacion = (typeof SEXOS)[number];

export class ImportRowDto {
  @ApiProperty({ description: 'Fila del archivo de origen' })
  @IsInt()
  @Min(2)
  fila: number;

  @ApiProperty({ enum: TIPOS_DOC_IMPORTACION })
  @IsIn(TIPOS_DOC_IMPORTACION)
  tipoDocIdentidad: TipoDocImportacion;

  @ApiProperty({ description: 'DNI de 8 dígitos o carné de extranjería de 9 a 12 caracteres' })
  @Matches(/^([0-9]{8}|[A-Z0-9]{9,12})$/, { message: 'El documento debe ser un DNI de 8 dígitos o un carné de 9 a 12 caracteres' })
  numeroDoc: string;

  @ApiProperty({ type: String, enum: SEXOS, nullable: true })
  @IsOptional()
  @IsIn(SEXOS)
  sexo: SexoImportacion | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  fechaNacimiento: string | null;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  nombres: string;

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  apellidoPaterno: string;

  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  apellidoMaterno: string | null;

  @ApiProperty({ enum: TIPOS_PERSONAL })
  @IsIn(TIPOS_PERSONAL)
  tipoPersonal: TipoPersonalValor;

  @ApiProperty({ description: 'Nombre del régimen en el catálogo' })
  @IsString()
  @Length(1, 80)
  regimen: string;

  @ApiProperty()
  @IsString()
  @Length(1, 140)
  area: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  cargo: string;

  @ApiProperty({ enum: ESTADOS })
  @IsIn(ESTADOS)
  estado: EstadoValor;

  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true })
  fechaIngreso: string;

  @ApiProperty({ enum: MOTIVOS_CESE, nullable: true })
  @IsOptional()
  @IsIn(MOTIVOS_CESE)
  motivoCese: MotivoCeseValor | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  fechaCese: string | null;

  @ApiProperty({ type: [String], description: 'Avisos que no impiden importar la fila' })
  @IsArray()
  @IsString({ each: true })
  avisos: string[];
}

export class ImportPreviewDto {
  @ApiProperty({ type: [ImportRowDto] })
  validos: ImportRowDto[];

  @ApiProperty({ type: [String] })
  observaciones: string[];

  @ApiProperty()
  total: number;
}

export class ImportCommitDto {
  @ApiProperty({ type: [ImportRowDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'No hay trabajadores para importar' })
  @ArrayMaxSize(MAXIMO_IMPORTACION, { message: `Máximo ${MAXIMO_IMPORTACION} trabajadores por importación` })
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  filas: ImportRowDto[];
}

export class ImportResultDto {
  @ApiProperty()
  importados: number;

  @ApiProperty({ description: 'Áreas y cargos que se agregaron a los catálogos' })
  catalogosCreados: number;
}
