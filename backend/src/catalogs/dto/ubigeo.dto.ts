import { ApiProperty } from '@nestjs/swagger';

export class UbigeoProvinceDto {
  @ApiProperty({ example: 'Tambopata' })
  nombre: string;

  @ApiProperty({ type: [String], example: ['Inambari', 'Laberinto', 'Las Piedras', 'Tambopata'] })
  distritos: string[];
}

export class UbigeoDepartmentDto {
  @ApiProperty({ example: 'Madre de Dios' })
  nombre: string;

  @ApiProperty({ type: [UbigeoProvinceDto] })
  provincias: UbigeoProvinceDto[];
}
