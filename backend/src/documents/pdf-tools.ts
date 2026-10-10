import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const TIEMPO_MAXIMO_MS = 10 * 60 * 1000;

export interface ResultadoComando {
  codigo: number;
  salida: string;
}

export function ejecutar(comando: string, argumentos: string[]): Promise<ResultadoComando> {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(comando, argumentos, { stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = '';
    const acumular = (parte: Buffer) => {
      if (salida.length < 20000) {
        salida += parte.toString('utf8');
      }
    };
    proceso.stdout.on('data', acumular);
    proceso.stderr.on('data', acumular);
    const temporizador = setTimeout(() => proceso.kill('SIGKILL'), TIEMPO_MAXIMO_MS);
    proceso.on('error', (error) => {
      clearTimeout(temporizador);
      rechazar(error);
    });
    proceso.on('close', (codigo) => {
      clearTimeout(temporizador);
      resolver({ codigo: codigo ?? -1, salida });
    });
  });
}

export function hashArchivo(ruta: string): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const hash = createHash('sha256');
    createReadStream(ruta)
      .on('data', (parte) => hash.update(parte))
      .on('error', rechazar)
      .on('end', () => resolver(hash.digest('hex')));
  });
}

export function argumentosGhostscript(entrada: string, salida: string, ppp: number, grises: boolean): string[] {
  return [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.7',
    '-dPDFSETTINGS=/ebook',
    '-dDownsampleColorImages=true',
    `-dColorImageResolution=${ppp}`,
    '-dDownsampleGrayImages=true',
    `-dGrayImageResolution=${ppp}`,
    '-dDownsampleMonoImages=true',
    '-dMonoImageResolution=300',
    '-dDetectDuplicateImages=true',
    '-dSubsetFonts=true',
    ...(grises ? ['-sColorConversionStrategy=Gray', '-dProcessColorModel=/DeviceGray'] : []),
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    '-dQUIET',
    `-sOutputFile=${salida}`,
    entrada,
  ];
}
