import type { TrabajadorResumen } from './models';
import { diasRestantes, fechaCorta, iniciales, nombreCompleto, numeroSeccion, puedeReingresar, tamanoLegible, tonoSeccion } from './labels';

function trabajador(cambios: Partial<TrabajadorResumen>): TrabajadorResumen {
  return {
    id: '1',
    tipoDocIdentidad: 'DNI',
    numeroDoc: '12345678',
    nombres: 'Ana María',
    apellidoPaterno: 'Quispe',
    apellidoMaterno: 'Mamani',
    estado: 'ACTIVO',
    movimientoActual: 'SIN_MOVIMIENTO',
    movimientoFecha: null,
    fechaIngreso: '2020-01-01',
    vinculo: null,
    ...cambios,
  };
}

describe('nombreCompleto', () => {
  it('une los apellidos y pone los nombres al final', () => {
    expect(nombreCompleto(trabajador({}))).toBe('Quispe Mamani, Ana María');
  });

  it('omite el apellido materno vacío o ausente', () => {
    expect(nombreCompleto(trabajador({ apellidoMaterno: null }))).toBe('Quispe, Ana María');
    expect(nombreCompleto(trabajador({ apellidoMaterno: '' }))).toBe('Quispe, Ana María');
  });
});

describe('iniciales', () => {
  it('toma la primera letra del nombre y del apellido paterno en mayúscula', () => {
    expect(iniciales(trabajador({ nombres: 'luis', apellidoPaterno: 'garcía' }))).toBe('LG');
  });
});

describe('puedeReingresar', () => {
  it('solo permite reingresar a un trabajador cesado', () => {
    expect(puedeReingresar(trabajador({ estado: 'ACTIVO' }))).toBe(false);
    expect(puedeReingresar(trabajador({ estado: 'CESADO' }))).toBe(true);
  });

  it('no permite reingresar a un trabajador fallecido', () => {
    const fallecido = trabajador({
      estado: 'CESADO',
      vinculo: {
        id: 'v',
        regimen: { id: 1, nombre: 'D. Leg. 276' },
        tipoPersonal: 'ADMINISTRATIVO',
        area: { id: 1, nombre: 'Personal' },
        cargo: { id: 1, nombre: 'Técnico' },
        fechaInicio: '2020-01-01',
        fechaFin: '2024-01-01',
        motivoFin: 'FALLECIMIENTO',
        referencia: null,
        actual: true,
      },
    });
    expect(puedeReingresar(fallecido)).toBe(false);
  });
});

describe('fechaCorta', () => {
  it('muestra un texto cuando no hay fecha', () => {
    expect(fechaCorta(null)).toBe('No registrada');
  });

  it('no corre la fecha un día por la zona horaria', () => {
    expect(fechaCorta('2026-03-01')).toContain('2026');
    expect(fechaCorta('2026-03-01')).toMatch(/^1\s/);
  });
});

describe('numeroSeccion', () => {
  it('completa con cero a la izquierda', () => {
    expect(numeroSeccion(1)).toBe('01');
    expect(numeroSeccion(13)).toBe('13');
  });
});

describe('tonoSeccion', () => {
  it('devuelve un color para cada una de las 13 secciones', () => {
    const tonos = Array.from({ length: 13 }, (_, indice) => tonoSeccion(indice + 1));
    expect(new Set(tonos).size).toBe(13);
    tonos.forEach((tono) => expect(tono).toMatch(/^#[0-9a-f]{6}$/));
  });
});

describe('tamanoLegible', () => {
  it('expresa en KB con un mínimo de 1', () => {
    expect(tamanoLegible(10)).toBe('1 KB');
    expect(tamanoLegible(2048)).toBe('2 KB');
  });

  it('expresa en MB con coma decimal', () => {
    expect(tamanoLegible(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });
});

describe('diasRestantes', () => {
  it('describe vencidos, el día de hoy y los que faltan', () => {
    expect(diasRestantes(-1)).toBe('Venció hace 1 día');
    expect(diasRestantes(-5)).toBe('Venció hace 5 días');
    expect(diasRestantes(0)).toBe('Vence hoy');
    expect(diasRestantes(1)).toBe('Faltan 1 día');
    expect(diasRestantes(30)).toBe('Faltan 30 días');
  });
});
