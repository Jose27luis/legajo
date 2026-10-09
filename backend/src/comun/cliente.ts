import { isIP } from 'node:net';
import type { Request } from 'express';

export interface DatosCliente {
  ip: string | null;
  userAgent: string | null;
}

function cabeceraUnica(solicitud: Request, nombre: string): string | null {
  const valor = solicitud.headers[nombre];
  if (typeof valor === 'string') {
    return valor.trim();
  }
  return null;
}

export function datosCliente(solicitud: Request): DatosCliente {
  const candidatas = [
    cabeceraUnica(solicitud, 'cf-connecting-ip'),
    cabeceraUnica(solicitud, 'x-real-ip'),
    solicitud.socket.remoteAddress ?? null,
  ];
  const ip = candidatas.find((candidata): candidata is string => candidata !== null && isIP(candidata) !== 0) ?? null;
  const agente = cabeceraUnica(solicitud, 'user-agent');
  return { ip, userAgent: agente === null ? null : agente.slice(0, 400) };
}
