import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CambiarClaveDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString({ message: 'Ingresa tu contraseña actual' })
  @Length(1, 200, { message: 'Ingresa tu contraseña actual' })
  claveActual: string;

  @ApiProperty({ minLength: 10, maxLength: 100, description: 'Al menos una letra y un número' })
  @IsString({ message: 'Ingresa la nueva contraseña' })
  @Length(10, 100, { message: 'La nueva contraseña debe tener entre 10 y 100 caracteres' })
  @Matches(/^(?=.*[A-Za-zÁÉÍÓÚÑáéíóúñ])(?=.*\d).+$/, { message: 'La nueva contraseña debe tener al menos una letra y un número' })
  claveNueva: string;
}
