import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { TIPOS_CAMPO, type DocumentFormDto, type SectionFieldDto } from './dto/catalog.dto';

const esquemaCampos = z.array(
  z.object({
    clave: z.string(),
    etiqueta: z.string(),
    tipo: z.enum(TIPOS_CAMPO),
    opciones: z.array(z.string()).optional(),
    dependeDe: z.object({ clave: z.string(), opciones: z.record(z.string(), z.array(z.string())) }).optional(),
    obligatorio: z.boolean(),
  }),
);

const esquemaFormulario = z.object({
  numero: z.string().optional(),
  fechaEmision: z.string().optional(),
  emisor: z.string().optional(),
  emisorOpciones: z.array(z.string()).optional(),
  fechaVencimiento: z.string().optional(),
});

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function leerFormulario(valor: unknown): DocumentFormDto {
  const resultado = esquemaFormulario.safeParse(valor);
  return resultado.success ? resultado.data : {};
}

export type ValorCampo = string | number | null;

export function leerCampos(valor: unknown): SectionFieldDto[] {
  const resultado = esquemaCampos.safeParse(valor);
  if (!resultado.success) {
    throw new Error('La definición de campos de una sección no es válida');
  }
  return resultado.data;
}

export function leerDatosGuardados(valor: unknown): Record<string, ValorCampo> {
  const resultado = z.record(z.string(), z.union([z.string(), z.number(), z.null()])).safeParse(valor);
  return resultado.success ? resultado.data : {};
}

export function validarDatos(campos: SectionFieldDto[], entrada: Record<string, unknown>): Record<string, ValorCampo> {
  const desconocidos = Object.keys(entrada).filter((clave) => !campos.some((campo) => campo.clave === clave));
  if (desconocidos.length > 0) {
    throw new BadRequestException(`Campos no válidos para esta sección: ${desconocidos.join(', ')}`);
  }
  const resultado: Record<string, ValorCampo> = {};
  for (const campo of campos) {
    const bruto = entrada[campo.clave];
    const vacio = bruto === undefined || bruto === null || (typeof bruto === 'string' && bruto.trim() === '');
    if (vacio) {
      if (campo.obligatorio) {
        throw new BadRequestException(`Completa el campo "${campo.etiqueta}"`);
      }
      resultado[campo.clave] = null;
      continue;
    }
    resultado[campo.clave] = convertir(campo, bruto);
  }
  for (const campo of campos) {
    const valor = resultado[campo.clave];
    const padre = campo.dependeDe === undefined ? undefined : resultado[campo.dependeDe.clave];
    const permitidas = typeof padre === 'string' ? campo.dependeDe?.opciones[padre] : undefined;
    if (typeof valor === 'string' && permitidas !== undefined && !permitidas.includes(valor)) {
      throw new BadRequestException(`"${campo.etiqueta}": la opción no corresponde a lo elegido antes`);
    }
  }
  return resultado;
}

export type CatalogoReferido = 'regimen' | 'area' | 'cargo';

export function referenciasACatalogo(campos: SectionFieldDto[], datos: Record<string, ValorCampo>): Record<CatalogoReferido, number[]> {
  const referencias: Record<CatalogoReferido, number[]> = { regimen: [], area: [], cargo: [] };
  for (const campo of campos) {
    const valor = datos[campo.clave];
    if ((campo.tipo === 'regimen' || campo.tipo === 'area' || campo.tipo === 'cargo') && typeof valor === 'number') {
      referencias[campo.tipo].push(valor);
    }
  }
  return referencias;
}

function convertir(campo: SectionFieldDto, valor: unknown): ValorCampo {
  const error = (detalle: string) => new BadRequestException(`"${campo.etiqueta}": ${detalle}`);
  switch (campo.tipo) {
    case 'regimen':
    case 'area':
    case 'cargo': {
      const identificador = typeof valor === 'number' ? valor : Number(valor);
      if (!Number.isInteger(identificador) || identificador <= 0) {
        throw error('elige una opción de la lista');
      }
      return identificador;
    }
    case 'numero': {
      const numero = typeof valor === 'number' ? valor : Number(valor);
      if (!Number.isInteger(numero) || numero < 0 || numero > 9999) {
        throw error('ingresa un número entero válido');
      }
      return numero;
    }
    case 'fecha': {
      if (typeof valor !== 'string' || !FECHA.test(valor) || Number.isNaN(Date.parse(valor))) {
        throw error('usa una fecha válida');
      }
      return valor;
    }
    case 'seleccion': {
      if (typeof valor !== 'string' || !(campo.opciones ?? []).includes(valor)) {
        throw error('elige una de las opciones');
      }
      return valor;
    }
    case 'contrato': {
      if (typeof valor !== 'string' || !UUID.test(valor)) {
        throw error('elige un contrato de la lista');
      }
      return valor;
    }
    case 'parrafo':
    case 'texto': {
      if (typeof valor !== 'string') {
        throw error('debe ser texto');
      }
      const limpio = valor.trim().replace(/\s+/g, ' ');
      const maximo = campo.tipo === 'parrafo' ? 1000 : 200;
      if (limpio.length > maximo) {
        throw error(`máximo ${maximo} caracteres`);
      }
      return limpio;
    }
  }
}
