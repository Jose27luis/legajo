import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, Length, Matches } from 'class-validator';

const normalizar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

export class UpdateUserDto {
  @ApiProperty({ minLength: 3, maxLength: 120 })
  @Transform(recortar)
  @IsString({ message: 'Ingresa el nombre completo' })
  @Length(3, 120, { message: 'El nombre completo debe tener entre 3 y 120 caracteres' })
  nombreCompleto: string;

  @ApiProperty({ maxLength: 120 })
  @Transform(normalizar)
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @Length(3, 120, { message: 'El correo no puede superar los 120 caracteres' })
  correo: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Selecciona un rol' })
  rolId: string;
}

export class CreateUserDto extends UpdateUserDto {
  @ApiProperty({ minLength: 4, maxLength: 30, description: 'Letras minúsculas, números, punto, guion y guion bajo' })
  @Transform(normalizar)
  @IsString({ message: 'Ingresa el nombre de usuario' })
  @Matches(/^[a-z0-9._-]{4,30}$/, {
    message: 'El usuario debe tener de 4 a 30 caracteres: letras, números, punto, guion o guion bajo',
  })
  usuario: string;
}
