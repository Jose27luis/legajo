import { spawn } from 'node:child_process';

const TIEMPO_MAXIMO_MS = 6 * 60 * 60 * 1000;
const LIMITE_SALIDA = 5 * 1024 * 1024;
const LIMITE_ERRORES = 4000;
export const CODIGO_SIN_REPOSITORIO = 10;

export interface ResultadoRestic {
  codigo: number;
  salida: string;
  errores: string;
}

export interface ResumenCopia {
  snapshotId: string;
  bytesAgregados: number;
}

export class FalloRestic extends Error {}

export function variablesBaseDeDatos(url: string): Record<string, string> {
  const direccion = new URL(url);
  return {
    PGHOST: direccion.hostname,
    PGPORT: direccion.port === '' ? '5432' : direccion.port,
    PGUSER: decodeURIComponent(direccion.username),
    PGPASSWORD: decodeURIComponent(direccion.password),
    PGDATABASE: direccion.pathname.replace('/', ''),
  };
}

export function ejecutarRestic(argumentos: string[], variables: Record<string, string>): Promise<ResultadoRestic> {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn('restic', argumentos, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...variables },
    });
    let salida = '';
    let errores = '';
    proceso.stdout.on('data', (parte: Buffer) => {
      if (salida.length < LIMITE_SALIDA) {
        salida += parte.toString('utf8');
      }
    });
    proceso.stderr.on('data', (parte: Buffer) => {
      errores = (errores + parte.toString('utf8')).slice(-LIMITE_ERRORES);
    });
    const temporizador = setTimeout(() => proceso.kill('SIGKILL'), TIEMPO_MAXIMO_MS);
    proceso.on('error', (error) => {
      clearTimeout(temporizador);
      rechazar(error);
    });
    proceso.on('close', (codigo) => {
      clearTimeout(temporizador);
      resolver({ codigo: codigo ?? -1, salida, errores });
    });
  });
}

export function exigirExito(resultado: ResultadoRestic, paso: string): ResultadoRestic {
  if (resultado.codigo !== 0) {
    const detalle = resultado.errores.trim().split('\n').slice(-3).join(' ');
    throw new FalloRestic(`${paso}: ${detalle === '' ? `restic terminó con el código ${resultado.codigo}` : detalle}`);
  }
  return resultado;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

export function leerResumenCopia(salida: string): ResumenCopia {
  for (const linea of salida.split('\n').reverse()) {
    if (linea.trim() === '') {
      continue;
    }
    const datos: unknown = JSON.parse(linea);
    if (esObjeto(datos) && datos['message_type'] === 'summary' && typeof datos['snapshot_id'] === 'string') {
      const empaquetado = datos['data_added_packed'];
      const agregado = datos['data_added'];
      return {
        snapshotId: datos['snapshot_id'],
        bytesAgregados: typeof empaquetado === 'number' ? empaquetado : typeof agregado === 'number' ? agregado : 0,
      };
    }
  }
  throw new FalloRestic('restic no devolvió el resumen de la copia');
}

export function leerEspacio(salida: string): number {
  const datos: unknown = JSON.parse(salida);
  return esObjeto(datos) && typeof datos['total_size'] === 'number' ? datos['total_size'] : 0;
}

export function leerSnapshots(salida: string): { id: string; fecha: string; etiquetas: string[]; rutas: string[] }[] {
  const datos: unknown = JSON.parse(salida);
  if (!Array.isArray(datos)) {
    return [];
  }
  const textos = (valor: unknown): string[] => (Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : []);
  return datos.filter(esObjeto).map((snapshot) => ({
    id: typeof snapshot['id'] === 'string' ? snapshot['id'] : '',
    fecha: typeof snapshot['time'] === 'string' ? snapshot['time'] : '',
    etiquetas: textos(snapshot['tags']),
    rutas: textos(snapshot['paths']),
  }));
}
