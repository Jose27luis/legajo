import { expect, test, type Locator, type Page } from '@playwright/test';

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') {
    throw new Error(`Falta la variable ${nombre} para las pruebas E2E`);
  }
  return valor;
}

const USUARIO = variable('E2E_USUARIO');
const CLAVE = variable('E2E_CLAVE');
const MARCA = String(Date.now()).slice(-8);
const DNI = MARCA;
const AREA = `Oficina de Personal ${MARCA}`;
const CARGO = `Técnico administrativo ${MARCA}`;
const APELLIDO = `PRUEBA${MARCA}`;

test.describe.configure({ mode: 'serial' });

let pagina: Page;
let rutaTrabajador = '';

function pdfMinimo(): Buffer {
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>',
  ];
  let contenido = '%PDF-1.4\n';
  const posiciones: number[] = [];
  objetos.forEach((objeto, indice) => {
    posiciones.push(contenido.length);
    contenido += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioXref = contenido.length;
  contenido += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  contenido += posiciones.map((posicion) => `${String(posicion).padStart(10, '0')} 00000 n \n`).join('');
  contenido += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(contenido, 'latin1');
}

function archivoPdf(nombre: string): { name: string; mimeType: string; buffer: Buffer } {
  return { name: `${nombre}.pdf`, mimeType: 'application/pdf', buffer: pdfMinimo() };
}

test.beforeAll(async ({ browser }) => {
  pagina = await browser.newPage();
});

test.afterAll(async () => {
  await pagina.close();
});

async function elegirEnBuscador(campo: Locator, texto: string, opcion: string): Promise<void> {
  await campo.click();
  await campo.fill(texto);
  await pagina.getByRole('option', { name: opcion }).click();
  await expect(campo).toHaveValue(opcion);
}

async function elegirEnLista(campo: Locator, opcion: string): Promise<void> {
  await campo.click();
  await pagina.getByRole('option', { name: opcion, exact: true }).click();
  await expect(campo).toHaveValue(opcion);
}

async function elegirTipo(nombre: string): Promise<void> {
  const campo = pagina.locator('#nuevo-tipo');
  await campo.click();
  if ((await campo.getAttribute('readonly')) === null) {
    await campo.fill(nombre.slice(0, 20));
  }
  await pagina.getByRole('option', { name: nombre, exact: true }).click();
  await expect(campo).toHaveValue(nombre);
}

async function abrirSeccion(numero: number): Promise<void> {
  await pagina.goto(`${rutaTrabajador}/sections/${numero}`);
  await expect(pagina.getByText(`Sección ${String(numero).padStart(2, '0')} de 12`)).toBeVisible();
}

async function registrarPdf(nombreArchivo: string, aviso: RegExp): Promise<void> {
  await pagina.locator('#nuevo-archivo').setInputFiles(archivoPdf(nombreArchivo));
  await pagina.getByRole('button', { name: 'Registrar PDF' }).click();
  await expect(pagina.getByRole('status').filter({ hasText: aviso }).last()).toBeVisible();
}

async function estadoTrabajador(): Promise<string> {
  const respuesta = await pagina.request.get(`/api${rutaTrabajador}`);
  expect(respuesta.ok()).toBe(true);
  const cuerpo: unknown = await respuesta.json();
  return typeof cuerpo === 'object' && cuerpo !== null && 'estado' in cuerpo ? String(cuerpo.estado) : '';
}

const SUBIDAS_SIMPLES: readonly { seccion: number; tipo: string }[] = [
  { seccion: 3, tipo: 'Títulos o grados de estudios superiores técnicos o universitarios' },
  { seccion: 4, tipo: 'Certificados de trabajo' },
  { seccion: 5, tipo: 'Rol de vacaciones' },
  { seccion: 6, tipo: 'Certificado de retención de quinta categoría' },
  { seccion: 8, tipo: 'Carta de felicitación' },
  { seccion: 9, tipo: 'Acta que indique la afiliación sindical' },
  { seccion: 10, tipo: 'Documentos de descansos médicos' },
];

async function iniciarSesion(identificador: string, clave: string): Promise<void> {
  await pagina.goto('/login');
  await pagina.locator('#identificador').fill(identificador);
  await pagina.locator('#clave').fill(clave);
  await pagina.getByRole('button', { name: 'Ingresar' }).click();
}

test('rechaza credenciales incorrectas', async () => {
  await iniciarSesion(USUARIO, 'clave-incorrecta-123');
  await expect(pagina.getByRole('alert')).toBeVisible();
  await expect(pagina).toHaveURL(/\/login$/);
});

test('inicia sesión y muestra el panel principal', async () => {
  await iniciarSesion(USUARIO, CLAVE);
  await expect(pagina.getByRole('heading', { name: 'Panel de control del personal' })).toBeVisible();
  await expect(pagina.getByText('Sistema Web de Legajos Digitales')).toBeVisible();
});

test('crea un área en Áreas y dependencias y un cargo en los catálogos', async () => {
  await pagina.goto('/areas');
  await pagina.getByRole('button', { name: 'Nueva área o dependencia' }).click();
  await pagina.locator('#area-nombre').fill(AREA);
  await pagina.getByRole('button', { name: 'Crear área' }).click();
  await expect(pagina.getByRole('cell', { name: AREA })).toBeVisible();

  await pagina.goto('/catalogs');
  await pagina.getByRole('tab', { name: 'Cargos' }).click();
  await pagina.getByRole('button', { name: 'Nuevo cargo' }).click();
  await pagina.locator('#cargo-nombre').fill(CARGO);
  await pagina.getByRole('button', { name: 'Crear cargo' }).click();
  await expect(pagina.getByRole('cell', { name: CARGO })).toBeVisible();
});

test('registra un nuevo ingreso y abre su ficha', async () => {
  await pagina.goto('/workers');
  await pagina.getByRole('button', { name: 'Registrar nuevo ingreso' }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Registrar trabajador que recién ingresa' });
  await expect(dialogo).toBeVisible();

  await dialogo.locator('#ingreso-numero').fill(DNI);
  await expect(dialogo.getByText('Disponible: se creará un legajo nuevo.')).toBeVisible();
  await dialogo.locator('#ingreso-nombres').fill('Ana María');
  await dialogo.locator('#ingreso-paterno').fill(APELLIDO);
  await dialogo.locator('#ingreso-materno').fill('Mamani');
  await elegirEnLista(dialogo.getByRole('combobox', { name: 'Tipo de personal' }), 'Administrativo');
  await elegirEnLista(dialogo.getByRole('combobox', { name: 'Régimen o modalidad' }), 'D. Leg. 276');
  await elegirEnBuscador(dialogo.getByRole('combobox', { name: 'Cargo o puesto' }), MARCA, CARGO);
  await elegirEnBuscador(dialogo.getByRole('combobox', { name: 'Área o dependencia' }), MARCA, AREA);
  await dialogo.locator('#ingreso-fecha').fill('2026-01-05');
  await dialogo.getByRole('button', { name: 'Registrar ingreso' }).click();

  await expect(pagina).toHaveURL(/\/workers\/[0-9a-f-]+\/record\?nuevo=1$/);
  await expect(pagina.getByText(`${APELLIDO} MAMANI, ANA MARÍA`).first()).toBeVisible();
  rutaTrabajador = new URL(pagina.url()).pathname.replace(/\/record$/, '');
});

test('impide registrar dos legajos con el mismo DNI', async () => {
  await pagina.goto('/workers');
  await pagina.getByRole('button', { name: 'Registrar nuevo ingreso' }).click();
  const dialogo = pagina.getByRole('dialog', { name: 'Registrar trabajador que recién ingresa' });
  await dialogo.locator('#ingreso-numero').fill(DNI);
  await expect(dialogo.getByText('Este documento ya corresponde a')).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Registrar ingreso' })).toBeDisabled();
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
});

test('un DNI en la búsqueda llena el filtro de trabajador', async () => {
  await pagina.goto('/search');
  await pagina.locator('#busqueda-texto').fill(DNI);
  await expect(pagina.locator('app-worker-picker').getByText(`${APELLIDO} Mamani, Ana María`)).toBeVisible();
  await expect(pagina.getByRole('link', { name: `${APELLIDO} Mamani, Ana María` }).first()).toBeVisible();
});

test('sube la copia del DNI en la Sección 01', async () => {
  await pagina.goto(`${rutaTrabajador}/record`);
  await expect(pagina.locator('#identidad-tipo')).toHaveValue('Copia del DNI o documento equivalente');
  await pagina.locator('#identidad-archivo').setInputFiles(archivoPdf('dni'));
  await pagina.getByRole('button', { name: 'Registrar documento de identidad' }).click();
  await expect(pagina.getByRole('status').filter({ hasText: 'Documento de identidad incorporado' }).last()).toBeVisible();
});

test('bloquea el formulario de carga hasta elegir el tipo de documento', async () => {
  await abrirSeccion(4);
  await expect(pagina.getByText('Selecciona un tipo de documento para habilitar el formulario de carga.')).toBeVisible();
  await expect(pagina.locator('#nuevo-observaciones')).toBeDisabled();
  await elegirTipo('Certificados de trabajo');
  await expect(pagina.locator('#nuevo-observaciones')).toBeEnabled();
  await expect(pagina.locator('#nuevo-dato-referenciaLaboral')).toBeVisible();
});

test('sube un contrato de renovación en la Sección 02 vinculado a la ficha', async () => {
  await abrirSeccion(2);
  await elegirTipo('Contrato');
  await elegirEnLista(pagina.locator('#nuevo-dato-tipoIncorporacion'), 'Renovación o continuidad');
  await elegirEnLista(pagina.locator('#nuevo-dato-regimen'), 'D. Leg. 276');
  await pagina.locator('#nuevo-dato-inicio').fill('2026-01-05');
  await pagina.locator('#nuevo-numero').fill(`CT-${MARCA}`);
  await registrarPdf('contrato', /vinculado automáticamente/);
});

for (const subida of SUBIDAS_SIMPLES) {
  test(`sube un PDF en la Sección ${String(subida.seccion).padStart(2, '0')}`, async () => {
    await abrirSeccion(subida.seccion);
    await elegirTipo(subida.tipo);
    await registrarPdf(`seccion-${subida.seccion}`, /PDF registrado/);
  });
}

test('sube un documento de desplazamiento en la Sección 07', async () => {
  await abrirSeccion(7);
  await elegirTipo('Documento de rotación');
  await expect(pagina.getByText('Número de documento (resolución, memorando u otro)')).toBeVisible();
  await registrarPdf('rotacion', /Confirma el movimiento/);
});

test('sube un documento en la Sección 12 con su justificación', async () => {
  await abrirSeccion(12);
  await elegirTipo('Otros documentos no clasificados');
  await pagina.locator('#nuevo-dato-justificacion').fill('No corresponde a ninguna de las otras secciones del legajo.');
  await registrarPdf('otros', /PDF registrado/);
});

test('confirma el cese con un PDF de la Sección 11', async () => {
  await abrirSeccion(11);
  await elegirTipo('Memorando de término de vínculo del servicio civil');
  await registrarPdf('cese', /confírmalo desde este detalle/);
  const confirmar = pagina.getByRole('button', { name: 'Confirmar cese laboral' });
  await expect(confirmar).toBeEnabled({ timeout: 60_000 });
  await confirmar.click();
  await elegirEnLista(pagina.locator('#cese-motivo'), 'Renuncia');
  await pagina.locator('#cese-fecha').fill('2026-02-10');
  await pagina.getByRole('button', { name: 'Confirmar cese', exact: true }).click();
  await expect(pagina.getByRole('status').filter({ hasText: 'Cese confirmado' }).last()).toBeVisible();
  expect(await estadoTrabajador()).toBe('CESADO');
});

test('un contrato de reingreso vuelve ACTIVO al trabajador cesado', async () => {
  await abrirSeccion(2);
  await elegirTipo('Contrato');
  await expect(pagina.locator('#nuevo-dato-tipoIncorporacion')).toHaveValue('Reingreso');
  await elegirEnLista(pagina.locator('#nuevo-dato-regimen'), 'D. Leg. 276');
  await pagina.locator('#nuevo-dato-inicio').fill('2026-03-02');
  await pagina.locator('#nuevo-numero').fill(`RE-${MARCA}`);
  await registrarPdf('reingreso', /reingreso aplicado/);
  expect(await estadoTrabajador()).toBe('ACTIVO');
});

test('exporta el padrón de trabajadores a Excel', async () => {
  await pagina.goto('/workers');
  const descarga = pagina.waitForEvent('download');
  await pagina.getByRole('link', { name: 'Exportar Excel' }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(/^trabajadores_\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(await archivo.failure()).toBeNull();
});

test('muestra la matriz de permisos por sección', async () => {
  await pagina.goto('/permissions');
  await expect(pagina.getByRole('heading', { name: 'Permisos por sección' })).toBeVisible();
  await expect(pagina.getByRole('columnheader', { name: 'Operador' })).toBeVisible();
});

test('cierra la sesión', async () => {
  await pagina.getByRole('button', { name: 'Salir' }).click();
  await expect(pagina).toHaveURL(/\/login$/);
  await pagina.goto('/workers');
  await expect(pagina).toHaveURL(/\/login$/);
});
