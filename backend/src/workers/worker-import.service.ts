import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DatosCliente } from '../common/client';
import type { SesionActiva } from '../common/session';
import { aFecha, hoyEnLima, normalizarBusqueda } from '../common/dates';
import { sinDuplicados } from '../common/unique-violation';
import { ESTABLECIMIENTOS, SEDE_DIRESA, UNIDADES_DIRESA } from '../organization-catalogs';
import { GRADOS_INSTRUCCION } from '../education-catalog';
import type {
  FormationImportDto,
  ImportPreviewDto,
  ImportResultDto,
  ImportRowDto,
  SexoImportacion,
  TipoDocImportacion,
} from './dto/worker-import.dto';
import type { MotivoCeseValor, TipoPersonalValor } from './dto/worker.dto';
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

interface FormacionLeida {
  gradoInstruccion: string | null;
  profesion: string | null;
  condicionProfesion: string | null;
}

function formacion(fila: FilaLeida): FormacionLeida {
  const textoGrado = normalizarBusqueda(primero(fila, 'grado_educativo_sustento', 'grado_educativo', 'grado_instruccion'));
  const grado = GRADOS_INSTRUCCION.find((item) => normalizarBusqueda(item.nombre) === textoGrado);
  if (grado === undefined) {
    return { gradoInstruccion: null, profesion: null, condicionProfesion: null };
  }
  const profesion = primero(fila, 'profesion_1', 'profesion').toUpperCase().slice(0, 120);
  const condicion = primero(fila, 'condicion_profesion_1', 'condicion_profesion').toUpperCase();
  return {
    gradoInstruccion: grado.nombre,
    profesion: profesion === '' ? null : profesion,
    condicionProfesion: grado.condiciones.includes(condicion) ? condicion : null,
  };
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

function fechaReal(anio: number, mes: number, dia: number): string | null {
  const calculada = new Date(Date.UTC(anio, mes - 1, dia));
  if (calculada.getUTCFullYear() !== anio || calculada.getUTCMonth() !== mes - 1 || calculada.getUTCDate() !== dia) {
    return null;
  }
  return calculada.toISOString().slice(0, 10);
}

function fecha(texto: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso !== null) {
    return fechaReal(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const partes = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(texto);
  return partes === null ? null : fechaReal(Number(partes[3]), Number(partes[2]), Number(partes[1]));
}

function primeraFecha(fila: FilaLeida, ...claves: string[]): string | null {
  for (const clave of claves) {
    const valor = fecha(primero(fila, clave));
    if (valor !== null) {
      return valor;
    }
  }
  return null;
}

const AREA_POR_RENIPRESS = new Map(ESTABLECIMIENTOS.map((establecimiento) => [establecimiento.codigo, establecimiento.nombre]));
const UNIDAD_POR_CLAVE = new Map(UNIDADES_DIRESA.map((unidad) => [compacto(unidad), unidad]));

function areaDelPadron(fila: FilaLeida): string | null {
  const codigo = primero(fila, 'codigo_renaes', 'codigo_renipress');
  if (codigo === '') {
    return null;
  }
  if (normalizarBusqueda(primero(fila, 'clasificacion_de_establecimiento')) === 'diresa') {
    return UNIDAD_POR_CLAVE.get(compacto(primero(fila, 'unidad_organica'))) ?? SEDE_DIRESA;
  }
  return AREA_POR_RENIPRESS.get(Number(codigo)) ?? (primero(fila, 'nombre_de_establecimiento') || null);
}

function tipoPersonal(fila: FilaLeida): TipoPersonalValor {
  const declarado = normalizarBusqueda(primero(fila, 'tipo', 'tipo_personal'));
  if (declarado !== '') {
    return declarado.startsWith('asist') ? 'ASISTENCIAL' : 'ADMINISTRATIVO';
  }
  return /asis|salud|medico/.test(normalizarBusqueda(primero(fila, 'grupo_reporte'))) ? 'ASISTENCIAL' : 'ADMINISTRATIVO';
}

function sexo(fila: FilaLeida): SexoImportacion | null {
  const valor = normalizarBusqueda(primero(fila, 'sexo'));
  if (valor.startsWith('m')) {
    return 'M';
  }
  return valor.startsWith('f') ? 'F' : null;
}

interface DocumentoLeido {
  tipo: TipoDocImportacion;
  numero: string;
}

function documento(fila: FilaLeida): DocumentoLeido | null {
  const tipo = normalizarBusqueda(primero(fila, 'tipo_documento', 'tipo_de_documento', 'tipo_doc'));
  const crudo = primero(fila, 'dni', 'numero_documento', 'numero_de_documento', 'documento');
  if (/carn|extranj/.test(tipo) || tipo === 'ce') {
    const numero = crudo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^[A-Z0-9]{9,12}$/.test(numero) ? { tipo: 'CE', numero } : null;
  }
  const limpio = crudo.replace(/\.0$/, '').replace(/\D/g, '');
  if (limpio === '' || limpio.length > 8) {
    return null;
  }
  const dni = limpio.padStart(8, '0');
  return dni === '00000000' ? null : { tipo: 'DNI', numero: dni };
}

const claveDocumento = (tipo: TipoDocImportacion, numero: string): string => `${tipo}:${numero}`;

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
    const documentos = filas.map(documento);
    const leidos = documentos.filter((item): item is DocumentoLeido => item !== null);
    const existentes = new Map(
      (
        await this.prisma.trabajador.findMany({
          where: { numeroDoc: { in: leidos.map((item) => item.numero) } },
          select: { tipoDocIdentidad: true, numeroDoc: true, gradoInstruccion: true, profesion: true, condicionProfesion: true },
        })
      ).map((trabajador) => [claveDocumento(trabajador.tipoDocIdentidad, trabajador.numeroDoc), trabajador]),
    );
    const completar: FormationImportDto[] = [];
    const areasConocidas = new Set(areas.map((area) => compacto(area.nombre)));
    const cargosConocidos = new Set(cargos.map((cargo) => compacto(cargo.nombre)));
    const hoy = hoyEnLima();
    const vistos = new Set<string>();
    const validos: ImportRowDto[] = [];
    const observaciones: string[] = [];

    filas.forEach((fila, indice) => {
      const numeroFila = indice + 2;
      const observar = (motivo: string) => observaciones.push(`Fila ${numeroFila}: ${motivo}`);
      const leido = documentos[indice] ?? null;
      if (leido === null) {
        observar('documento de identidad inválido (DNI de 8 dígitos o carné de 9 a 12 caracteres).');
        return;
      }
      const clave = claveDocumento(leido.tipo, leido.numero);
      if (vistos.has(clave)) {
        observar(`${leido.tipo} duplicado dentro del archivo (${leido.numero}).`);
        return;
      }
      vistos.add(clave);
      const registrado = existentes.get(clave);
      if (registrado !== undefined) {
        const leida = formacion(fila);
        const faltan =
          (registrado.gradoInstruccion === null && leida.gradoInstruccion !== null) ||
          (registrado.profesion === null && leida.profesion !== null) ||
          (registrado.condicionProfesion === null && leida.condicionProfesion !== null);
        if (leida.gradoInstruccion !== null && faltan) {
          completar.push({ tipoDocIdentidad: leido.tipo, numeroDoc: leido.numero, ...leida, gradoInstruccion: leida.gradoInstruccion });
          return;
        }
        observar(`${leido.tipo} ya registrado (${leido.numero}).`);
        return;
      }
      const nombres = primero(fila, 'nombres', 'nombre');
      const apellidoPaterno = primero(fila, 'apellido_paterno', 'paterno');
      if (nombres === '' || apellidoPaterno === '') {
        observar('faltan nombres o apellido paterno.');
        return;
      }
      const fechaIngreso = primeraFecha(
        fila,
        'fecha_ingreso',
        'ingreso',
        'fecha_de_ingreso',
        'fecha_de_primer_contrato',
        'fecha_de_nombramiento',
        'fecha_de_ingreso_al_eess_actual',
      );
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
      const area = areaDelPadron(fila) ?? (primero(fila, 'area', 'dependencia') || SIN_AREA);
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
      const nacimiento = primeraFecha(fila, 'fecha_nacimiento', 'fecha_de_nacimiento');
      validos.push({
        fila: numeroFila,
        tipoDocIdentidad: leido.tipo,
        numeroDoc: leido.numero,
        nombres,
        apellidoPaterno,
        apellidoMaterno: primero(fila, 'apellido_materno', 'materno') || null,
        sexo: sexo(fila),
        fechaNacimiento: nacimiento !== null && nacimiento < fechaIngreso ? nacimiento : null,
        tipoPersonal: tipoPersonal(fila),
        regimen: regimen.nombre,
        area,
        cargo,
        estado,
        fechaIngreso,
        motivoCese,
        fechaCese,
        ...formacion(fila),
        avisos,
      });
    });
    return { validos, completar, observaciones, total: filas.length };
  }

  async importar(
    filas: ImportRowDto[],
    completar: FormationImportDto[],
    sesion: SesionActiva,
    cliente: DatosCliente,
  ): Promise<ImportResultDto> {
    if (filas.length === 0 && completar.length === 0) {
      throw new ConflictException('No hay trabajadores para importar ni datos de formación para completar');
    }
    const fueraDeCatalogo = completar.find(
      (item) =>
        !GRADOS_INSTRUCCION.some(
          (grado) =>
            grado.nombre === item.gradoInstruccion && (item.condicionProfesion === null || grado.condiciones.includes(item.condicionProfesion)),
        ),
    );
    if (fueraDeCatalogo !== undefined) {
      throw new ConflictException(`${fueraDeCatalogo.numeroDoc}: el grado o la condición de la profesión no están en el catálogo`);
    }
    const documentos = filas.map((fila) => claveDocumento(fila.tipoDocIdentidad, fila.numeroDoc));
    if (new Set(documentos).size !== documentos.length) {
      throw new ConflictException('Hay documentos de identidad repetidos en la importación');
    }
    const invalido = filas.find((fila) => (fila.tipoDocIdentidad === 'DNI') !== /^[0-9]{8}$/.test(fila.numeroDoc));
    if (invalido !== undefined) {
      throw new ConflictException(`Fila ${invalido.fila}: el número no corresponde al tipo de documento`);
    }
    const existentes = await this.prisma.trabajador.count({
      where: {
        OR: (['DNI', 'CE'] as const).map((tipo) => ({
          tipoDocIdentidad: tipo,
          numeroDoc: { in: filas.filter((fila) => fila.tipoDocIdentidad === tipo).map((fila) => fila.numeroDoc) },
        })),
      },
    });
    if (existentes > 0) {
      throw new ConflictException('Alguno de los documentos de identidad ya fue registrado. Vuelve a validar el archivo.');
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
                  tipoDocIdentidad: fila.tipoDocIdentidad,
                  numeroDoc: fila.numeroDoc,
                  nombres: fila.nombres,
                  apellidoPaterno: fila.apellidoPaterno,
                  apellidoMaterno: fila.apellidoMaterno,
                  sexo: fila.sexo,
                  fechaNacimiento: fila.fechaNacimiento === null ? null : aFecha(fila.fechaNacimiento),
                  gradoInstruccion: fila.gradoInstruccion,
                  profesion: fila.profesion,
                  condicionProfesion: fila.condicionProfesion,
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
            let completados = 0;
            for (const item of completar) {
              const trabajador = await transaccion.trabajador.findUnique({
                where: { tipoDocIdentidad_numeroDoc: { tipoDocIdentidad: item.tipoDocIdentidad, numeroDoc: item.numeroDoc } },
                select: { id: true, gradoInstruccion: true, profesion: true, condicionProfesion: true },
              });
              if (trabajador === null) {
                continue;
              }
              const cambios = {
                ...(trabajador.gradoInstruccion === null ? { gradoInstruccion: item.gradoInstruccion } : {}),
                ...(trabajador.profesion === null && item.profesion !== null ? { profesion: item.profesion } : {}),
                ...(trabajador.condicionProfesion === null && item.condicionProfesion !== null
                  ? { condicionProfesion: item.condicionProfesion }
                  : {}),
              };
              if (Object.keys(cambios).length === 0) {
                continue;
              }
              await transaccion.trabajador.update({ where: { id: trabajador.id }, data: cambios });
              await this.auditoria.registrar(
                {
                  accion: 'TRABAJADOR_EDITAR',
                  entidad: 'trabajador',
                  entidadId: trabajador.id,
                  trabajadorId: trabajador.id,
                  usuarioId: sesion.usuarioId,
                  cliente,
                  detalle: { origen: 'padron', ...cambios },
                },
                transaccion,
              );
              completados++;
            }
            await this.auditoria.registrar(
              {
                accion: 'TRABAJADORES_IMPORTAR',
                entidad: 'trabajador',
                usuarioId: sesion.usuarioId,
                cliente,
                detalle: { importados: filas.length, completados, catalogosCreados },
              },
              transaccion,
            );
            return { importados: filas.length, completados, catalogosCreados };
          },
          { timeout: TIEMPO_TRANSACCION_MS, maxWait: 10000 },
        ),
      'Alguno de los documentos de identidad ya fue registrado. Vuelve a validar el archivo.',
    );
  }
}
