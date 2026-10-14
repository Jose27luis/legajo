import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsPositive, IsString, Length } from 'class-validator';
import { ESTADOS, type EstadoValor } from '../../workers/dto/worker.dto';

export const TIPOS_REPORTE = ['general', 'situacion', 'regimen', 'documentos', 'secciones', 'estadisticas'] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

const vacioANulo = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }
  const limpio = value.trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
};
const aBooleano = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';
const fechaMensaje = { message: 'Usa una fecha válida (AAAA-MM-DD)' };

export class GeneralReportFiltersDto {
  @ApiProperty({ enum: TIPOS_REPORTE, default: 'general' })
  @IsIn(TIPOS_REPORTE, { message: 'Tipo de reporte no válido' })
  tipo: TipoReporte = 'general';

  @ApiPropertyOptional({ enum: ESTADOS })
  @Transform(vacioANulo)
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: EstadoValor | null = null;

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

  @ApiPropertyOptional({ description: 'DNI, nombre o cargo' })
  @Transform(vacioANulo)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  busqueda?: string | null = null;

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
}

export class GeneralReportQueryDto extends GeneralReportFiltersDto {
  @ApiPropertyOptional({ description: 'Devuelve todas las filas para imprimir (hasta 5000)' })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  todos?: boolean;
}

export class GeneralReportSummaryDto {
  @ApiProperty()
  trabajadores: number;

  @ApiProperty({ description: 'Documentos no anulados del personal filtrado' })
  documentos: number;

  @ApiProperty({ description: 'PDF registrados y disponibles' })
  pdf: number;
}

export class GeneralReportDto {
  @ApiProperty({ enum: TIPOS_REPORTE })
  tipo: TipoReporte;

  @ApiProperty({ type: [String] })
  columnas: string[];

  @ApiProperty({ type: 'array', items: { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'number' }] } } })
  filas: Array<Array<string | number | null>>;

  @ApiProperty()
  total: number;

  @ApiProperty({ type: GeneralReportSummaryDto })
  resumen: GeneralReportSummaryDto;
}

export class StatisticItemDto {
  @ApiProperty()
  nombre: string;

  @ApiProperty()
  cantidad: number;
}

export class StatisticsDto {
  @ApiProperty()
  trabajadores: number;

  @ApiProperty()
  activos: number;

  @ApiProperty()
  cesados: number;

  @ApiProperty({ description: 'Documentos no anulados que la cuenta puede ver' })
  documentos: number;

  @ApiProperty({ description: 'PDF registrados y disponibles' })
  pdf: number;

  @ApiProperty({ type: [StatisticItemDto] })
  porSeccion: StatisticItemDto[];

  @ApiProperty({ type: [StatisticItemDto] })
  porRegimen: StatisticItemDto[];
}
