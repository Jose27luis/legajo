import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Publico } from '../comun/decoradores';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

class EstadoSaludDto {
  @ApiProperty({ example: 'ok' })
  estado: string;
}

@ApiTags('Salud')
@Controller('health')
export class SaludController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Publico()
  @Get()
  @ApiOperation({ summary: 'Estado de la API, la base de datos y Redis' })
  @ApiResponse({ status: 200, type: EstadoSaludDto })
  @ApiResponse({ status: 503, description: 'Alguna dependencia no responde' })
  async estado(): Promise<EstadoSaludDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.cliente.ping();
    } catch {
      throw new ServiceUnavailableException('Servicio no disponible');
    }
    return { estado: 'ok' };
  }
}
