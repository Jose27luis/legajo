import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Publico } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

class HealthStatusDto {
  @ApiProperty({ example: 'ok' })
  estado: string;
}

@ApiTags('Salud')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Publico()
  @Get()
  @ApiOperation({ summary: 'Estado de la API, la base de datos y Redis' })
  @ApiResponse({ status: 200, type: HealthStatusDto })
  @ApiResponse({ status: 503, description: 'Alguna dependencia no responde' })
  async estado(): Promise<HealthStatusDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.cliente.ping();
    } catch {
      throw new ServiceUnavailableException('Servicio no disponible');
    }
    return { estado: 'ok' };
  }
}
