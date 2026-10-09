import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class IniciarSesionDto {
  @ApiProperty({ description: 'Usuario o correo', minLength: 3, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString({ message: 'Ingresa tu usuario o correo' })
  @Length(3, 120, { message: 'El usuario o correo debe tener entre 3 y 120 caracteres' })
  identificador: string;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString({ message: 'Ingresa tu contraseña' })
  @Length(1, 200, { message: 'Ingresa tu contraseña' })
  clave: string;
}
