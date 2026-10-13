import { ApiProperty } from '@nestjs/swagger';

export class AuditUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  usuario: string;

  @ApiProperty()
  nombre: string;
}

export class AuditWorkerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  numeroDoc: string;

  @ApiProperty()
  nombre: string;
}

export class AuditEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ format: 'date-time' })
  fecha: string;

  @ApiProperty({ type: AuditUserDto, nullable: true })
  usuario: AuditUserDto | null;

  @ApiProperty()
  accion: string;

  @ApiProperty()
  entidad: string;

  @ApiProperty({ type: String, nullable: true })
  entidadId: string | null;

  @ApiProperty({ type: AuditWorkerDto, nullable: true })
  trabajador: AuditWorkerDto | null;

  @ApiProperty({ type: String, nullable: true })
  ip: string | null;

  @ApiProperty({ type: String, nullable: true })
  navegador: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Detalle en JSON' })
  detalle: string | null;
}

export class AuditPageDto {
  @ApiProperty({ type: [AuditEntryDto] })
  items: AuditEntryDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  porPagina: number;
}

export class AuditOptionsDto {
  @ApiProperty({ type: [String] })
  acciones: string[];

  @ApiProperty({ type: [AuditUserDto] })
  usuarios: AuditUserDto[];
}
