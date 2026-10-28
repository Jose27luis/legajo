import { ApiProperty } from '@nestjs/swagger';
import { ESTADOS, TIPOS_PERSONAL, type EstadoValor, type TipoPersonalValor } from '../../workers/dto/worker.dto';

export const SITUACIONES = ['COMPLETO', 'FALTANTE', 'VENCIDO'] as const;
export const SITUACIONES_CELDA = [...SITUACIONES, 'NO_APLICA'] as const;

export type SituacionValor = (typeof SITUACIONES)[number];
export type SituacionCeldaValor = (typeof SITUACIONES_CELDA)[number];

export class StaffRowDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  numeroDoc: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ type: String, nullable: true })
  regimen: string | null;

  @ApiProperty({ enum: TIPOS_PERSONAL, nullable: true })
  tipoPersonal: TipoPersonalValor | null;

  @ApiProperty({ type: String, nullable: true })
  cargo: string | null;

  @ApiProperty({ type: String, nullable: true })
  area: string | null;

  @ApiProperty({ format: 'date' })
  fechaIngreso: string;

  @ApiProperty({ enum: ESTADOS })
  estado: EstadoValor;

  @ApiProperty()
  requisitos: number;

  @ApiProperty()
  completos: number;

  @ApiProperty()
  vencidos: number;

  @ApiProperty()
  faltantes: number;

  @ApiProperty({ description: 'Porcentaje de requisitos completos' })
  completitud: number;
}

export class StaffReportDto {
  @ApiProperty({ type: [StaffRowDto] })
  items: StaffRowDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  porPagina: number;
}

export class RequirementStatusDto {
  @ApiProperty()
  tipoId: number;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  tipo: string;

  @ApiProperty()
  seccion: number;

  @ApiProperty({ enum: SITUACIONES })
  situacion: SituacionValor;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  documentoId: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  fechaEmision: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  fechaVencimiento: string | null;
}

export class WorkerMissingDto {
  @ApiProperty({ format: 'uuid' })
  trabajadorId: string;

  @ApiProperty()
  numeroDoc: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  requisitos: number;

  @ApiProperty()
  completos: number;

  @ApiProperty()
  vencidos: number;

  @ApiProperty()
  faltantes: number;

  @ApiProperty()
  completitud: number;

  @ApiProperty({ type: [RequirementStatusDto] })
  items: RequirementStatusDto[];
}

export class SummaryColumnDto {
  @ApiProperty()
  tipoId: number;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  seccion: number;
}

export class SummaryRowDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  numeroDoc: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ type: String, nullable: true })
  area: string | null;

  @ApiProperty({ enum: SITUACIONES_CELDA, isArray: true, description: 'Una situación por columna, en el mismo orden' })
  celdas: SituacionCeldaValor[];

  @ApiProperty()
  requisitos: number;

  @ApiProperty()
  completos: number;

  @ApiProperty()
  faltantes: number;

  @ApiProperty()
  vencidos: number;
}

export class MissingSummaryDto {
  @ApiProperty({ type: [SummaryColumnDto] })
  columnas: SummaryColumnDto[];

  @ApiProperty({ type: [SummaryRowDto] })
  items: SummaryRowDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  porPagina: number;
}

export class ExpiringRowDto {
  @ApiProperty({ format: 'uuid' })
  documentoId: string;

  @ApiProperty({ format: 'uuid' })
  trabajadorId: string;

  @ApiProperty()
  numeroDoc: string;

  @ApiProperty()
  trabajador: string;

  @ApiProperty({ enum: ESTADOS })
  estado: EstadoValor;

  @ApiProperty({ type: String, nullable: true })
  area: string | null;

  @ApiProperty()
  seccion: number;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  tipo: string;

  @ApiProperty({ type: String, nullable: true })
  numero: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  fechaEmision: string | null;

  @ApiProperty({ format: 'date' })
  fechaVencimiento: string;

  @ApiProperty({ description: 'Días que faltan; negativo si ya venció' })
  dias: number;
}

export class ExpiringReportDto {
  @ApiProperty({ type: [ExpiringRowDto] })
  items: ExpiringRowDto[];

  @ApiProperty()
  dias: number;

  @ApiProperty()
  vencidos: number;

  @ApiProperty()
  porVencer: number;

  @ApiProperty({ description: 'Documentos registrados con fecha de vencimiento' })
  conFecha: number;

  @ApiProperty({ description: 'Documentos registrados sin fecha de vencimiento' })
  sinFecha: number;
}

export class DigitizationRowDto {
  @ApiProperty()
  usuario: string;

  @ApiProperty({ format: 'date' })
  dia: string;

  @ApiProperty()
  documentos: number;

  @ApiProperty()
  folios: number;

  @ApiProperty({ description: 'Tamaño en bytes de los archivos guardados' })
  tamano: number;
}

export class DigitizationUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nombre: string;
}

export class DigitizationReportDto {
  @ApiProperty({ type: [DigitizationRowDto] })
  items: DigitizationRowDto[];

  @ApiProperty({ type: [DigitizationUserDto], description: 'Cuentas que han cargado documentos' })
  usuarios: DigitizationUserDto[];

  @ApiProperty()
  documentos: number;

  @ApiProperty()
  folios: number;

  @ApiProperty()
  tamano: number;
}

export class ProgressRowDto {
  @ApiProperty()
  area: string;

  @ApiProperty()
  trabajadores: number;

  @ApiProperty()
  completos: number;

  @ApiProperty()
  parciales: number;

  @ApiProperty()
  vacios: number;

  @ApiProperty()
  completitud: number;
}

export class ProgressReportDto {
  @ApiProperty({ type: [ProgressRowDto] })
  items: ProgressRowDto[];

  @ApiProperty({ type: ProgressRowDto })
  totales: ProgressRowDto;
}
