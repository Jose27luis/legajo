import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aFecha, hoyEnLima, normalizarBusqueda } from '../common/dates';
import { sinDuplicados } from '../common/unique-violation';
import type { ImportPreviewDto, ImportResultDto, ImportRowDto } from './dto/worker-import.dto';
import type { MotivoCeseValor } from './dto/worker.dto';
import { leerArchivo, type FilaLeida } from './import-parser';

const SIN_AREA = 'No especificada';
const SIN_CARGO = 'No especificado';
const REGIMEN_POR_DEFECTO = 'OTRO';
const TIEMPO_TRANSACCION_MS = 120000;

const MOTIVOS: ReadonlyArray<[RegExp, MotivoCeseValor]> = [
  [/renuncia/, 'RENUNCIA'],
  [/jubila/, 'JUBILACION'],
  [/falleci/, 'FALLECIMIENTO'],
  [/(fin|termino|vencimiento).*contrato/, 'FIN_CONTRATO'],
  [/destitu/, 'DESTITUCION'],
];

interface RegimenCatalogo {
  id: number;
  codigo: string;
  nombre: string;
}

function compacto(texto: string): string {
  return normalizarBusqueda(texto).replace(/[^a-z0-9]/g, '');
}

function primero(fila: FilaLeida, ...claves: string[]): string {
  for (const clave of claves) {
    const valor = fila[clave];
    if (valor !== undefined && valor.trim() !== '') {
      return valor.trim().replace(/\s+/g, ' ');
    }
  }
  return '';
}

function fecha(texto: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return Number.isNaN(Date.parse(texto)) ? null : texto;
  }
  const partes = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(texto);
  if (partes === null) {
    return null;
  }
  const iso = `${partes[3]}-${partes[2].padStart(2, '0')}-${partes[1].padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function buscarRegimen(texto: string, regimenes: RegimenCatalogo[]): RegimenCatalogo | null {
  const buscado = compacto(texto);
  const exacto = regimenes.find((regimen) => compacto(regimen.nombre) === buscado || compacto(regimen.codigo) === buscado);
  if (exacto !== undefined) {
    return exacto;
  }
  const numero = /\d{3,5}/.exec(buscado)?.[0];
  if (numero !== undefined) {
    return regimenes.find((regimen) => compacto(regimen.nombre).includes(numero)) ?? null;
  }
  if (buscado.includes('cas')) {
    return regimenes.find((regimen) => compacto(regimen.nombre).includes('cas')) ?? null;
  }
  if (buscado.includes('locacion')) {
    return regimenes.find((regimen) => regimen.codigo === 'LOCACION') ?? null;
  }
  return null;
}

@Injectable()
export class WorkerImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditService,
  ) {}

  async previsualizar(nombre: string, contenido: Buffer): Promise<ImportPreviewDto> {
    const filas = await leerArchivo(nombre, contenido);
    const [regimenes, areas, cargos] = await Promise.all([
      this.prisma.regimen.findMany({ where: { activo: true }, select: { id: true, codigo: true, nombre: true } }),
      this.prisma.area.findMany({ where: { activo: true }, select: { nombre: true } }),
      this.prisma.cargo.findMany({ where: { activo: true }, select: { nombre: true } }),
    ]);
    const documentos = filas.map((fila) => this.normalizarDni(primero(fila, 'dni', 'numero_documento', 'documento')));
    const existentes = new Set(
      (
        await this.prisma.trabajador.findMany({
          where: { tipoDocIdentidad: 'DNI', numeroDoc: { in: documentos.filter((dni) => dni !== null) } },
          select: { numeroDoc: true },
        })
      ).map((trabajador) => trabajador.numeroDoc),
    );
    const areasConocidas = new Set(areas.map((area) => compacto(area.nombre)));
    const cargosConocidos = new Set(cargos.map((cargo) => compacto(cargo.nombre)));
    const hoy = hoyEnLima();
    const vistos = new Set<string>();
    const validos: ImportRowDto[] = [];
    const observaciones: string[] = [];

    filas.forEach((fila, indice) => {
      const numeroFila = indice + 2;
      const observar = (motivo: string) => observaciones.push(`Fila ${numeroFila}: ${motivo}`);
      const dni = documentos[indice];
      if (dni === null) {
        observar('DNI inválido.');
        return;
      }
      if (vistos.has(dni)) {
        observar(`DNI duplicado dentro del archivo (${dni}).`);
        return;
      }
      vistos.add(dni);
      if (existentes.has(dni)) {
        observar(`DNI ya registrado (${dni}).`);
        return;
      }
      const nombres = primero(fila, 'nombres', 'nombre');
      const apellidoPaterno = primero(fila, 'apellido_paterno', 'paterno');
      if (nombres === '' || apellidoPaterno === '') {
        observar('faltan nombres o apellido paterno.');
        return;
      }
      const fechaIngreso = fecha(primero(fila, 'fecha_ingreso', 'ingreso'));
      if (fechaIngreso === null) {
        observar('falta la fecha de ingreso o no es válida (usa AAAA-MM-DD o DD/MM/AAAA).');
        return;
      }
      if (fechaIngreso > hoy) {
        observar('la fecha de ingreso no puede ser futura.');
        return;
      }
      const avisos: string[] = [];
      const textoRegimen = primero(fila, 'regimen', 'regimen_laboral');
      const regimen =
        textoRegimen === '' ? regimenes.find((item) => item.codigo === REGIMEN_POR_DEFECTO) ?? null : buscarRegimen(textoRegimen, regimenes);
      if (regimen === null) {
        observar(`régimen no reconocido (${textoRegimen}). Usa uno de los registrados en Catálogos.`);
        return;
      }
      if (textoRegimen === '') {
        avisos.push(`Sin régimen: se registra como ${regimen.nombre}.`);
      }
      const area = primero(fila, 'area', 'dependencia') || SIN_AREA;
      const cargo = primero(fila, 'cargo', 'puesto') || SIN_CARGO;
      if (!areasConocidas.has(compacto(area))) {
        avisos.push(`El área «${area}» se agregará a Catálogos.`);
      }
      if (!cargosConocidos.has(compacto(cargo))) {
        avisos.push(`El cargo «${cargo}» se agregará a Catálogos.`);
      }
      const estado = normalizarBusqueda(primero(fila, 'estado', 'estado_laboral')) === 'cesado' ? 'CESADO' : 'ACTIVO';
      let motivoCese: MotivoCeseValor | null = null;
      let fechaCese: string | null = null;
      if (estado === 'CESADO') {
        fechaCese = fecha(primero(fila, 'fecha_cese', 'cese'));
        if (fechaCese === null || fechaCese < fechaIngreso || fechaCese > hoy) {
          observar('un trabajador cesado necesita una fecha de cese válida, posterior al ingreso y no futura.');
          return;
        }
        const textoMotivo = normalizarBusqueda(primero(fila, 'motivo', 'motivo_cese'));
        motivoCese = MOTIVOS.find(([patron]) => patron.test(textoMotivo))?.[1] ?? 'OTRA_CAUSA';
        if (motivoCese === 'OTRA_CAUSA') {
          avisos.push('Motivo de cese no indicado o no reconocido: se registra como Otra causa.');
        }
      }
      validos.push({
        fila: numeroFila,
        numeroDoc: dni,
        nombres,
        apellidoPaterno,
        apellidoMaterno: primero(fila, 'apellido_materno', 'materno') || null,
        tipoPersonal: normalizarBusqueda(primero(fila, 'tipo', 'tipo_personal')).startsWith('asist') ? 'ASISTENCIAL' : 'ADMINISTRATIVO',
        regimen: regimen.nombre,
        area,
        cargo,
        estado,
        fechaIngreso,
        motivoCese,
        fechaCese,
        avisos,
      });
    });
    return { validos, observaciones, total: filas.length };
  }

  async importar(filas: ImportRowDto[], sesion: SesionActiva, cliente: DatosCliente): Promise<ImportResultDto> {
    const documentos = filas.map((fila) => fila.numeroDoc);
    if (new Set(documentos).size !== documentos.length) {
      throw new ConflictException('Hay DNI repetidos en la importación');
    }
    const existentes = await this.prisma.trabajador.count({ where: { tipoDocIdentidad: 'DNI', numeroDoc: { in: documentos } } });
    if (existentes > 0) {
      throw new ConflictException('Alguno de los DNI ya fue registrado. Vuelve a validar el archivo.');
    }
    const regimenes = await this.prisma.regimen.findMany({ where: { activo: true }, select: { id: true, nombre: true } });
    const idRegimen = new Map(regimenes.map((regimen) => [regimen.nombre, regimen.id]));
    const faltante = filas.find((fila) => !idRegimen.has(fila.regimen));
    if (faltante !== undefined) {
      throw new ConflictException(`Fila ${faltante.fila}: el régimen «${faltante.regimen}» ya no está activo`);
    }
    const hoy = hoyEnLima();
    const invalida = filas.find(
      (fila) =>
        fila.fechaIngreso > hoy ||
        (fila.estado === 'CESADO' && (fila.fechaCese === null || fila.fechaCese < fila.fechaIngreso || fila.fechaCese > hoy)),
    );
    if (invalida !== undefined) {
      throw new ConflictException(`Fila ${invalida.fila}: revisa las fechas de ingreso y de cese`);
    }

    return sinDuplicados(
      () =>
        this.prisma.$transaction(
          async (transaccion) => {
            const areas = new Map(
              (await transaccion.area.findMany({ select: { id: true, nombre: true } })).map((area) => [compacto(area.nombre), area.id]),
            );
            const cargos = new Map(
              (await transaccion.cargo.findMany({ select: { id: true, nombre: true } })).map((cargo) => [compacto(cargo.nombre), cargo.id]),
            );
            let catalogosCreados = 0;
            const resolver = async (tipo: 'area' | 'cargo', nombre: string): Promise<number> => {
              const mapa = tipo === 'area' ? areas : cargos;
              const conocido = mapa.get(compacto(nombre));
              if (conocido !== undefined) {
                return conocido;
              }
              const creado =
                tipo === 'area'
                  ? await transaccion.area.create({ data: { nombre: nombre.slice(0, 140) } })
                  : await transaccion.cargo.create({ data: { nombre: nombre.slice(0, 120) } });
              mapa.set(compacto(nombre), creado.id);
              catalogosCreados++;
              await this.auditoria.registrar(
                {
                  accion: 'CATALOGO_CREAR',
                  entidad: tipo,
                  entidadId: String(creado.id),
                  usuarioId: sesion.usuarioId,
                  cliente,
                  detalle: { nombre, origen: 'importacion' },
                },
                transaccion,
              );
              return creado.id;
            };
            for (const fila of filas) {
              const areaId = await resolver('area', fila.area);
              const cargoId = await resolver('cargo', fila.cargo);
              const cesado = fila.estado === 'CESADO' && fila.fechaCese !== null;
              const trabajador = await transaccion.trabajador.create({
                data: {
                  tipoDocIdentidad: 'DNI',
                  numeroDoc: fila.numeroDoc,
                  nombres: fila.nombres,
                  apellidoPaterno: fila.apellidoPaterno,
                  apellidoMaterno: fila.apellidoMaterno,
                  fechaIngreso: aFecha(fila.fechaIngreso),
                  estado: cesado ? 'CESADO' : 'ACTIVO',
                  vinculos: {
                    create: {
                      regimenId: idRegimen.get(fila.regimen) ?? 0,
                      tipoPersonal: fila.tipoPersonal,
                      cargoId,
                      areaId,
                      fechaInicio: aFecha(fila.fechaIngreso),
                      fechaFin: cesado && fila.fechaCese !== null ? aFecha(fila.fechaCese) : null,
                      motivoFin: cesado ? (fila.motivoCese ?? 'OTRA_CAUSA') : null,
                      referencia: 'Importación de personal',
                    },
                  },
                },
                select: { id: true },
              });
              await this.auditoria.registrar(
                {
                  accion: 'TRABAJADOR_CREAR',
                  entidad: 'trabajador',
                  entidadId: trabajador.id,
                  trabajadorId: trabajador.id,
                  usuarioId: sesion.usuarioId,
                  cliente,
                  detalle: { origen: 'importacion', fila: fila.fila, estado: fila.estado },
                },
                transaccion,
              );
            }
            await this.auditoria.registrar(
              {
                accion: 'TRABAJADORES_IMPORTAR',
                entidad: 'trabajador',
                usuarioId: sesion.usuarioId,
                cliente,
                detalle: { importados: filas.length, catalogosCreados },
              },
              transaccion,
            );
            return { importados: filas.length, catalogosCreados };
          },
          { timeout: TIEMPO_TRANSACCION_MS, maxWait: 10000 },
        ),
      'Alguno de los DNI ya fue registrado. Vuelve a validar el archivo.',
    );
  }

  private normalizarDni(texto: string): string | null {
    const limpio = texto.replace(/\.0$/, '').replace(/\D/g, '');
    if (limpio === '' || limpio.length > 8) {
      return null;
    }
    const dni = limpio.padStart(8, '0');
    return dni === '00000000' ? null : dni;
  }
}
