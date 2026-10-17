import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, Max, Min } from 'class-validator';

export class SectionRefDto {
  @ApiProperty()
  numero: number;

  @ApiProperty()
  nombre: string;
}

export class RoleSectionAccessDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ description: 'El administrador conserva acceso a todas las secciones' })
  bloqueado: boolean;

  @ApiProperty({ type: [Number], description: 'Secciones que el rol no puede consultar' })
  restringidas: number[];
}

export class SectionAccessDto {
  @ApiProperty({ type: [SectionRefDto] })
  secciones: SectionRefDto[];

  @ApiProperty({ type: [RoleSectionAccessDto] })
  roles: RoleSectionAccessDto[];
}

export class UpdateSectionAccessDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMaxSize(11)
  @IsInt({ each: true })
  @Min(2, { each: true, message: 'La sección 01 es la ficha del trabajador y no se restringe' })
  @Max(12, { each: true })
  restringidas: number[];
}
