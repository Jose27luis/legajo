import { ApiProperty } from '@nestjs/swagger';

export class RoleSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nombre: string;
}

export class RoleDto extends RoleSummaryDto {
  @ApiProperty()
  descripcion: string;
}

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  usuario: string;

  @ApiProperty()
  nombreCompleto: string;

  @ApiProperty()
  correo: string;

  @ApiProperty({ type: RoleSummaryDto })
  rol: RoleSummaryDto;

  @ApiProperty()
  activo: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  bloqueadoHasta: string | null;

  @ApiProperty()
  debeCambiarClave: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  ultimoAcceso: string | null;

  @ApiProperty({ format: 'date-time' })
  creadoEn: string;
}

export class TemporaryPasswordDto {
  @ApiProperty({ type: UserDto })
  usuario: UserDto;

  @ApiProperty({ description: 'Se muestra una sola vez' })
  claveTemporal: string;
}
