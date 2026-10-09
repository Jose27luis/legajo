import { ApiProperty } from '@nestjs/swagger';

export class UsuarioSesionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  usuario: string;

  @ApiProperty()
  nombreCompleto: string;

  @ApiProperty()
  correo: string;

  @ApiProperty()
  rol: string;

  @ApiProperty({ type: [String] })
  permisos: string[];

  @ApiProperty()
  debeCambiarClave: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  ultimoAcceso: string | null;
}

export class MensajeDto {
  @ApiProperty()
  mensaje: string;
}
