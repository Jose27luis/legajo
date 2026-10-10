import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

export async function sinDuplicados<T>(operacion: () => Promise<T>, mensaje: string): Promise<T> {
  try {
    return await operacion();
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(mensaje);
    }
    throw error;
  }
}
