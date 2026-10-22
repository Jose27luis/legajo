import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  ESTADOS,
  MOTIVOS_CAMBIO,
  MOTIVOS_CESE,
  MOVIMIENTOS,
  TIPOS_DOC,
  TIPOS_PERSONAL,
  type EstadoValor,
  type MotivoCambioValor,
  type MotivoCeseValor,
  type MovimientoValor,
  type TipoDocValor,
  type TipoPersonalValor,
} from './worker.dto';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const vacioANulo = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const limpio = value.trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
};
const documento = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const fechaMensaje = { message: 'Usa una fecha válida (AAAA-MM-DD)' };
const SEXOS = ['F', 'M'] as const;
const ESTADOS_CIVILES = ['Soltero(a)', 'Casado(a)', 'Conviviente', 'Divorciado(a)', 'Viudo(a)'] as const;

class DocumentoIdentidad {
  @ApiProperty({ enum: TIPOS_DOC })
  @IsIn(TIPOS_DOC, { message: 'Tipo de documento no válido' })
  tipoDocIdentidad: TipoDocValor;

  @ApiProperty({ description: 'DNI de 8 dígitos o carné de extranjería de 9 a 12 caracteres' })
  @Transform(documento)
  @IsString()
  @Matches(/^[A-Z0-9]{8,12}$/, { message: 'Ingresa el número de documento' })
  numeroDoc: string;
}

class DatosVinculo extends DocumentoIdentidad {
  @ApiProperty()
  @IsInt({ message: 'Selecciona el régimen' })
  @IsPositive({ message: 'Selecciona el régimen' })
  regimenId: number;

  @ApiProperty({ enum: TIPOS_PERSONAL })
  @IsIn(TIPOS_PERSONAL, { message: 'Selecciona el tipo de personal' })
  tipoPersonal: TipoPersonalValor;

  @ApiProperty()
  @IsInt({ message: 'Selecciona el cargo' })
  @IsPositive({ message: 'Selecciona el cargo' })
  cargoId: number;

  @ApiProperty()
  @IsInt({ message: 'Selecciona el área' })
  @IsPositive({ message: 'Selecciona el área' })
  areaId: number;

  @ApiPropertyOptional({ maxLength: 160 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 160)
  referencia: string | null = null;
}

export class CreateWorkerDto extends DatosVinculo {
  @ApiProperty({ maxLength: 100 })
  @Transform(recortar)
  @IsString({ message: 'Ingresa los nombres' })
  @Length(1, 100, { message: 'Ingresa los nombres' })
  nombres: string;

  @ApiProperty({ maxLength: 80 })
  @Transform(recortar)
  @IsString({ message: 'Ingresa el apellido paterno' })
  @Length(1, 80, { message: 'Ingresa el apellido paterno' })
  apellidoPaterno: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 80)
  apellidoMaterno: string | null = null;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  fechaNacimiento: string | null = null;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 200)
  direccion: string | null = null;

  @ApiPropertyOptional({ maxLength: 60 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 60)
  departamento: string | null = null;

  @ApiPropertyOptional({ maxLength: 60 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 60)
  provincia: string | null = null;

  @ApiPropertyOptional({ maxLength: 60 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 60)
  distrito: string | null = null;

  @ApiPropertyOptional({ maxLength: 20 })
  @Transform(vacioANulo)
  @IsOptional()
  @Matches(/^[0-9+() -]{6,20}$/, { message: 'Teléfono no válido' })
  telefono: string | null = null;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsEmail({}, { message: 'Correo no válido' })
  correo: string | null = null;

  @ApiPropertyOptional({ maxLength: 40, description: 'Grado de instrucción, según el catálogo de formación' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 40)
  gradoInstruccion: string | null = null;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  profesion: string | null = null;

  @ApiPropertyOptional({ maxLength: 40, description: 'Documento que sustenta la profesión: título, bachiller, constancia de egresado…' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 40)
  condicionProfesion: string | null = null;

  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true }, fechaMensaje)
  fechaIngreso: string;
}

export class UpdateWorkerDto extends DocumentoIdentidad {
  @ApiProperty({ maxLength: 100 })
  @Transform(recortar)
  @IsString()
  @Length(1, 100, { message: 'Ingresa los nombres' })
  nombres: string;

  @ApiProperty({ maxLength: 80 })
  @Transform(recortar)
  @IsString()
  @Length(1, 80, { message: 'Ingresa el apellido paterno' })
  apellidoPaterno: string;

  @ApiPropertyOptional()
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 80)
  apellidoMaterno: string | null = null;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  fechaNacimiento: string | null = null;

  @ApiPropertyOptional({ enum: SEXOS })
  @Transform(vacioANulo)
  @IsOptional()
  @IsIn(SEXOS)
  sexo: string | null = null;

  @ApiPropertyOptional({ enum: ESTADOS_CIVILES })
  @Transform(vacioANulo)
  @IsOptional()
  @IsIn(ESTADOS_CIVILES)
  estadoCivil: string | null = null;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 200)
  direccion: string | null = null;

  @ApiPropertyOptional({ maxLength: 60 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 60)
  departamento: string | null = null;

  @ApiPropertyOptional({ maxLength: 60 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 60)
  provincia: string | null = null;

  @ApiPropertyOptional({ maxLength: 60 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 60)
  distrito: string | null = null;

  @ApiPropertyOptional({ maxLength: 20 })
  @Transform(vacioANulo)
  @IsOptional()
  @Matches(/^[0-9+() -]{6,20}$/, { message: 'Teléfono no válido' })
  telefono: string | null = null;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsEmail({}, { message: 'Correo no válido' })
  correo: string | null = null;

  @ApiPropertyOptional({ maxLength: 40, description: 'Grado de instrucción, según el catálogo de formación' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 40)
  gradoInstruccion: string | null = null;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  profesion: string | null = null;

  @ApiPropertyOptional({ maxLength: 40, description: 'Documento que sustenta la profesión: título, bachiller, constancia de egresado…' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 40)
  condicionProfesion: string | null = null;

  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true }, fechaMensaje)
  fechaIngreso: string;
}

export class SituationDto {
  @ApiProperty({ enum: ESTADOS })
  @IsIn(ESTADOS)
  estado: EstadoValor;

  @ApiProperty({ enum: MOVIMIENTOS })
  @IsIn(MOVIMIENTOS)
  movimiento: MovimientoValor;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  movimientoFecha: string | null = null;

  @ApiPropertyOptional({ description: 'Área o puesto de origen del movimiento' })
  @Transform(vacioANulo)
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Elige el área de origen' })
  @IsPositive({ message: 'Elige el área de origen' })
  areaOrigenId: number | null = null;

  @ApiPropertyOptional({ description: 'Área o dependencia de destino del movimiento' })
  @Transform(vacioANulo)
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Elige el área de destino' })
  @IsPositive({ message: 'Elige el área de destino' })
  areaDestinoId: number | null = null;

  @ApiPropertyOptional({ enum: MOTIVOS_CESE })
  @Transform(vacioANulo)
  @IsOptional()
  @IsIn(MOTIVOS_CESE, { message: 'Selecciona el motivo del cese' })
  motivoCese: MotivoCeseValor | null = null;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  fechaCese: string | null = null;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 500)
  observacion: string | null = null;
}

class NuevoVinculo {
  @ApiProperty()
  @IsInt({ message: 'Selecciona el régimen' })
  @IsPositive({ message: 'Selecciona el régimen' })
  regimenId: number;

  @ApiProperty({ enum: TIPOS_PERSONAL })
  @IsIn(TIPOS_PERSONAL, { message: 'Selecciona el tipo de personal' })
  tipoPersonal: TipoPersonalValor;

  @ApiProperty()
  @IsInt({ message: 'Selecciona el cargo' })
  @IsPositive({ message: 'Selecciona el cargo' })
  cargoId: number;

  @ApiProperty()
  @IsInt({ message: 'Selecciona el área' })
  @IsPositive({ message: 'Selecciona el área' })
  areaId: number;

  @ApiPropertyOptional({ maxLength: 160 })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 160)
  referencia: string | null = null;
}

export class ReentryDto extends NuevoVinculo {
  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true }, fechaMensaje)
  fechaIngreso: string;
}

export class LinkChangeDto extends NuevoVinculo {
  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true }, fechaMensaje)
  fechaInicio: string;

  @ApiProperty({ enum: MOTIVOS_CAMBIO })
  @IsIn(MOTIVOS_CAMBIO, { message: 'Selecciona el motivo del cambio' })
  motivo: MotivoCambioValor;
}

export class RelativeInputDto {
  @ApiProperty({ maxLength: 30 })
  @Transform(recortar)
  @IsString()
  @Length(2, 30, { message: 'Indica el parentesco' })
  parentesco: string;

  @ApiProperty({ maxLength: 160 })
  @Transform(recortar)
  @IsString()
  @Length(3, 160, { message: 'Ingresa nombres y apellidos' })
  nombresApellidos: string;

  @ApiPropertyOptional({ maxLength: 12 })
  @Transform(vacioANulo)
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{8,12}$/, { message: 'Documento no válido' })
  numeroDoc: string | null = null;

  @ApiPropertyOptional({ format: 'date' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsISO8601({ strict: true }, fechaMensaje)
  fechaNacimiento: string | null = null;
}

export class WorkerQueryDto {
  @ApiPropertyOptional()
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  busqueda?: string | null = null;

  @ApiPropertyOptional({ enum: ESTADOS })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: EstadoValor;

  @ApiPropertyOptional({ enum: MOVIMIENTOS })
  @IsOptional()
  @IsIn(MOVIMIENTOS)
  movimiento?: MovimientoValor;

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

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  porPagina?: number;
}

export class LookupQueryDto {
  @ApiProperty({ enum: TIPOS_DOC })
  @IsIn(TIPOS_DOC)
  tipo: TipoDocValor;

  @ApiProperty()
  @Transform(documento)
  @IsString()
  @Matches(/^[A-Z0-9]{8,12}$/, { message: 'Documento no válido' })
  numero: string;
}
