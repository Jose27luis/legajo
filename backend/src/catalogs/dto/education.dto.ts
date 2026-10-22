import { ApiProperty } from '@nestjs/swagger';

export class EducationLevelDto {
  @ApiProperty({ example: 'Superior completo' })
  nombre: string;

  @ApiProperty({ type: [String], example: ['ENFERMERA(O)', 'MEDICO CIRUJANO'] })
  profesiones: string[];

  @ApiProperty({ type: [String], example: ['BACHILLER', 'CONSTANCIA DE EGRESADO', 'TITULO', 'OTRO DOCUMENTO'] })
  condiciones: string[];
}
