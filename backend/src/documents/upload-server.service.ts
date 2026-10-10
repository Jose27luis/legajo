import { open } from 'node:fs/promises';
import { Inject, Injectable } from '@nestjs/common';
import { FileStore } from '@tus/file-store';
import { Server, type Upload } from '@tus/server';
import { ENTORNO, type Entorno } from '../environment/environment';
import { SessionService } from '../auth/session.service';
import { NOMBRE_COOKIE_SESION, type SesionActiva } from '../common/session';
import { rutaSubida } from './document-queue';

const VEINTICUATRO_HORAS_MS = 24 * 60 * 60 * 1000;
const FIRMA_PDF = '%PDF-';

class ErrorSubida extends Error {
  constructor(
    readonly status_code: number,
    readonly body: string,
  ) {
    super(body);
  }
}

interface SolicitudWeb {
  method: string;
  headers: { get(nombre: string): string | null };
}

function leerCookie(cabecera: string | null, nombre: string): string | null {
  if (cabecera === null) {
    return null;
  }
  for (const parte of cabecera.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) {
      return decodeURIComponent(resto.join('='));
    }
  }
  return null;
}

@Injectable()
export class UploadServerService {
  readonly almacen: FileStore;
  readonly servidor: Server;

  constructor(
    @Inject(ENTORNO) private readonly entorno: Entorno,
    private readonly sesiones: SessionService,
  ) {
    this.almacen = new FileStore({ directory: entorno.DIR_SUBIDAS, expirationPeriodInMilliseconds: VEINTICUATRO_HORAS_MS });
    this.servidor = new Server({
      path: '/api/uploads',
      datastore: this.almacen,
      maxSize: entorno.TAMANO_MAXIMO_MB * 1024 * 1024,
      relativeLocation: true,
      onIncomingRequest: async (solicitud, subidaId) => {
        const sesion = await this.autenticar(solicitud);
        if (solicitud.method !== 'POST' && subidaId !== '') {
          const subida = await this.almacen.getUpload(subidaId);
          if (subida.metadata?.['usuario'] !== sesion.usuarioId) {
            throw new ErrorSubida(403, 'Esta subida pertenece a otro usuario');
          }
        }
      },
      onUploadCreate: async (solicitud, subida) => {
        const sesion = await this.autenticar(solicitud);
        const nombre = subida.metadata?.['filename'] ?? '';
        if (!nombre.toLowerCase().endsWith('.pdf')) {
          throw new ErrorSubida(415, 'Solo se aceptan archivos PDF');
        }
        return { metadata: { filename: nombre.slice(-200), usuario: sesion.usuarioId } };
      },
      onUploadFinish: async (_solicitud, subida) => {
        if (!(await this.esPdf(subida))) {
          await this.almacen.remove(subida.id);
          throw new ErrorSubida(415, 'El archivo no es un PDF válido');
        }
        return {};
      },
    });
  }

  async obtener(subidaId: string): Promise<Upload | null> {
    try {
      return await this.almacen.getUpload(subidaId);
    } catch {
      return null;
    }
  }

  private async autenticar(solicitud: SolicitudWeb): Promise<SesionActiva> {
    if (solicitud.method !== 'GET' && solicitud.method !== 'HEAD' && solicitud.headers.get('x-legajos') !== '1') {
      throw new ErrorSubida(403, 'Solicitud no permitida');
    }
    const sid = leerCookie(solicitud.headers.get('cookie'), NOMBRE_COOKIE_SESION);
    const sesion = sid === null ? null : await this.sesiones.obtener(sid);
    if (sesion === null) {
      throw new ErrorSubida(401, 'Tu sesión terminó. Vuelve a iniciar sesión.');
    }
    if (sesion.debeCambiarClave || !sesion.permisos.includes('documentos.subir')) {
      throw new ErrorSubida(403, 'No tienes permiso para subir documentos');
    }
    return sesion;
  }

  private async esPdf(subida: Upload): Promise<boolean> {
    const archivo = await open(rutaSubida(this.entorno.DIR_SUBIDAS, subida.id), 'r');
    try {
      const { buffer, bytesRead } = await archivo.read(Buffer.alloc(FIRMA_PDF.length), 0, FIRMA_PDF.length, 0);
      return bytesRead === FIRMA_PDF.length && buffer.toString('latin1') === FIRMA_PDF;
    } finally {
      await archivo.close();
    }
  }
}
