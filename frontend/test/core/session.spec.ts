import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import { autenticadoGuard, claveAlDiaGuard, invitadoGuard, permisoGuard } from '../../src/app/core/guards';
import type { UsuarioSesion } from '../../src/app/core/models';
import { SessionService } from '../../src/app/core/session.service';

const USUARIO: UsuarioSesion = {
  id: 'u1',
  usuario: 'operador',
  nombreCompleto: 'Operador de Legajos',
  correo: 'operador@diresa.gob.pe',
  rol: 'Operador',
  permisos: ['personal.ver', 'documentos.ver'],
  debeCambiarClave: false,
  ultimoAcceso: null,
};

describe('SessionService', () => {
  let http: HttpTestingController;
  let sesion: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SessionService);
  });

  afterEach(() => http.verify());

  it('consulta la sesión una sola vez aunque se pida varias veces a la vez', async () => {
    const primera = sesion.asegurar();
    const segunda = sesion.asegurar();
    http.expectOne('/api/auth/me').flush(USUARIO);
    expect(await primera).toEqual(USUARIO);
    expect(await segunda).toEqual(USUARIO);
    expect(sesion.autenticado()).toBe(true);
  });

  it('queda sin sesión cuando el servidor responde 401', async () => {
    const respuesta = sesion.asegurar();
    http.expectOne('/api/auth/me').flush({ message: 'No autenticado' }, { status: 401, statusText: 'Unauthorized' });
    expect(await respuesta).toBeNull();
    expect(sesion.tiene('personal.ver')).toBe(false);
  });

  it('evalúa los permisos del usuario', async () => {
    const respuesta = sesion.iniciar('operador', 'clave');
    http.expectOne('/api/auth/login').flush(USUARIO);
    await respuesta;
    expect(sesion.tiene('documentos.ver')).toBe(true);
    expect(sesion.tiene('usuarios.gestionar')).toBe(false);
  });

  it('borra la sesión al cerrar aunque el servidor falle', async () => {
    const inicio = sesion.iniciar('operador', 'clave');
    http.expectOne('/api/auth/login').flush(USUARIO);
    await inicio;
    const cierre = sesion.cerrar();
    http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Error' });
    await expect(cierre).rejects.toBeTruthy();
    expect(sesion.usuario()).toBeNull();
  });
});

@Component({ template: '' })
class PantallaVacia {}

const RUTAS: Routes = [
  { path: 'login', canMatch: [invitadoGuard], component: PantallaVacia },
  { path: 'change-password', canMatch: [autenticadoGuard], component: PantallaVacia },
  {
    path: '',
    canMatch: [autenticadoGuard, claveAlDiaGuard],
    children: [
      { path: '', pathMatch: 'full', component: PantallaVacia },
      { path: 'search', canMatch: [permisoGuard('documentos.ver')], component: PantallaVacia },
      { path: 'users', canMatch: [permisoGuard('usuarios.gestionar')], component: PantallaVacia },
    ],
  },
];

describe('guards de acceso', () => {
  let http: HttpTestingController;
  let router: Router;

  async function iniciarCon(usuario: UsuarioSesion | null): Promise<void> {
    const respuesta = TestBed.inject(SessionService).asegurar();
    const pedido = http.expectOne('/api/auth/me');
    if (usuario === null) {
      pedido.flush(null, { status: 401, statusText: 'Unauthorized' });
    } else {
      pedido.flush(usuario);
    }
    await respuesta;
  }

  async function navegar(url: string): Promise<string> {
    await router.navigateByUrl(url);
    return router.url;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(RUTAS)] });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  it('manda al login a quien no tiene sesión', async () => {
    let terminada = false;
    const navegacion = navegar('/search').finally(() => {
      terminada = true;
    });
    while (!terminada) {
      await new Promise((resolver) => setTimeout(resolver, 0));
      http.match('/api/auth/me').forEach((pedido) => pedido.flush(null, { status: 401, statusText: 'Unauthorized' }));
    }
    expect(await navegacion).toBe('/login');
  });

  it('saca del login a quien ya inició sesión', async () => {
    await iniciarCon(USUARIO);
    expect(await navegar('/login')).toBe('/');
  });

  it('obliga a cambiar la contraseña temporal', async () => {
    await iniciarCon({ ...USUARIO, debeCambiarClave: true });
    expect(await navegar('/search')).toBe('/change-password');
  });

  it('bloquea las pantallas sin permiso y deja pasar las permitidas', async () => {
    await iniciarCon(USUARIO);
    expect(await navegar('/search')).toBe('/search');
    expect(await navegar('/users')).toBe('/');
  });
});
