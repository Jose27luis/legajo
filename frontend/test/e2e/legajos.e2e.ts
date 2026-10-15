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

test('crea un área y un cargo en los catálogos', async () => {
  await pagina.goto('/catalogs');
  await pagina.getByRole('tab', { name: 'Áreas' }).click();
  await pagina.getByRole('button', { name: 'Nueva área' }).click();
  await pagina.locator('#area-nombre').fill(AREA);
  await pagina.getByRole('button', { name: 'Crear área' }).click();
  await expect(pagina.getByRole('cell', { name: AREA })).toBeVisible();

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
