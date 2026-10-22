import { ApiProperty } from '@nestjs/swagger';

export const TIPOS_PERSONAL = ['ADMINISTRATIVO', 'ASISTENCIAL'] as const;
export const APLICA_A = ['ACTIVO', 'CESADO', 'TODOS'] as const;
export const TIPOS_CAMPO = ['texto', 'fecha', 'numero', 'seleccion', 'parrafo', 'regimen', 'area', 'cargo', 'contrato'] as const;
export const ACCIONES_DOCUMENTO = ['NINGUNA', 'VINCULO', 'MOVIMIENTO', 'CESE'] as const;
export type AccionDocumentoValor = (typeof ACCIONES_DOCUMENTO)[number];

export type TipoPersonalValor = (typeof TIPOS_PERSONAL)[number];
export type AplicaAValor = (typeof APLICA_A)[number];

export class SectionFieldDto {
  @ApiProperty()
  clave: string;

  @ApiProperty()
  etiqueta: string;

  @ApiProperty({ enum: TIPOS_CAMPO })
  tipo: (typeof TIPOS_CAMPO)[number];

  @ApiProperty({ type: [String], required: false })
  opciones?: string[];

  @ApiProperty({
    required: false,
    description: 'Opciones que dependen del valor de otro campo: { clave del campo, opciones por valor }',
  })
  dependeDe?: { clave: string; opciones: Record<string, string[]> };

  @ApiProperty()
  obligatorio: boolean;
}

export class DocumentFormDto {
  @ApiProperty({ required: false, description: 'Etiqueta del número; si falta, el formulario no lo pide' })
  numero?: string;

  @ApiProperty({ required: false, description: 'Etiqueta de la fecha de emisión; si falta, no se pide' })
  fechaEmision?: string;

  @ApiProperty({ required: false, description: 'Etiqueta del emisor; si falta, no se pide' })
  emisor?: string;

  @ApiProperty({ type: [String], required: false, description: 'Opciones del emisor cuando es una lista' })
  emisorOpciones?: string[];

  @ApiProperty({ required: false, description: 'Etiqueta de la fecha de vencimiento; si falta, no se pide' })
  fechaVencimiento?: string;
}

export class DocumentTypeDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  seccionId: number;

  @ApiProperty({ example: '0202' })
  codigo: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  restringido: boolean;

  @ApiProperty()
  requiereNumero: boolean;

  @ApiProperty()
  tieneVencimiento: boolean;

  @ApiProperty()
  activo: boolean;

  @ApiProperty()
  orden: number;

  @ApiProperty({ enum: ACCIONES_DOCUMENTO, description: 'Efecto del documento sobre la ficha del trabajador' })
  accion: AccionDocumentoValor;

  @ApiProperty({ type: [SectionFieldDto], description: 'Campos propios del tipo documental' })
  campos: SectionFieldDto[];

  @ApiProperty({ type: DocumentFormDto, description: 'Campos comunes que pide el formulario de este tipo y sus etiquetas' })
  formulario: DocumentFormDto;
}

export class SectionDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  numero: number;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  carpeta: string;

  @ApiProperty()
  descripcion: string;

  @ApiProperty({ type: [SectionFieldDto] })
  campos: SectionFieldDto[];

  @ApiProperty({ type: [DocumentTypeDto] })
  tipos: DocumentTypeDto[];
}

export class RegimeDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  esLaboral: boolean;

  @ApiProperty()
  activo: boolean;
}

export class AreaDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ type: Number, nullable: true })
  padreId: number | null;

  @ApiProperty({ type: String, nullable: true })
  padreNombre: string | null;

  @ApiProperty()
  activo: boolean;
}

export class PositionDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  activo: boolean;
}

export class RequirementDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ type: DocumentTypeDto })
  tipoDocumento: DocumentTypeDto;

  @ApiProperty({ type: RegimeDto, nullable: true })
  regimen: RegimeDto | null;

  @ApiProperty({ enum: TIPOS_PERSONAL, nullable: true })
  tipoPersonal: TipoPersonalValor | null;

  @ApiProperty({ enum: APLICA_A })
  aplicaA: AplicaAValor;
}
