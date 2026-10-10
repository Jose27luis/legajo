import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { BrandComponent } from '../brand/brand.component';
import { IconComponent, type NombreIcono } from '../icon/icon.component';
import { ToastComponent } from '../toast/toast.component';

interface EnlaceMenu {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
  exacto: boolean;
  permiso: string | null;
}

interface GrupoMenu {
  titulo: string;
  enlaces: EnlaceMenu[];
}

const GRUPOS: readonly GrupoMenu[] = [
  {
    titulo: 'Gestión',
    enlaces: [
      { ruta: '/', etiqueta: 'Inicio', icono: 'inicio', exacto: true, permiso: null },
      { ruta: '/workers', etiqueta: 'Personal', icono: 'personal', exacto: false, permiso: 'personal.ver' },
    ],
  },
  {
    titulo: 'Administración',
    enlaces: [
      { ruta: '/users', etiqueta: 'Usuarios', icono: 'usuarios', exacto: false, permiso: 'usuarios.gestionar' },
      { ruta: '/catalogs', etiqueta: 'Catálogos', icono: 'catalogos', exacto: false, permiso: 'catalogos.gestionar' },
    ],
  },
];

const TITULOS: readonly [RegExp, string][] = [
  [/^\/$/, 'Inicio'],
  [/^\/workers\/[^/]+$/, 'Legajo del trabajador'],
  [/^\/workers$/, 'Personal'],
  [/^\/profile$/, 'Mi perfil'],
  [/^\/users$/, 'Usuarios'],
  [/^\/catalogs$/, 'Catálogos'],
];

const CLAVE_CONTRAIDO = 'legajos.menu-contraido';

function leerContraido(): boolean {
  try {
    return localStorage.getItem(CLAVE_CONTRAIDO) === '1';
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandComponent, IconComponent, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
  host: {
    '(document:click)': 'alPulsarDocumento($event)',
    '(document:keydown.escape)': 'cerrarMenus()',
  },
})
export class LayoutComponent {
  private readonly router = inject(Router);
  protected readonly sesion = inject(SessionService);
  private readonly zonaUsuario = viewChild.required<ElementRef<HTMLElement>>('zonaUsuario');

  protected readonly saliendo = signal(false);
  protected readonly contraido = signal(leerContraido());
  protected readonly menuMovil = signal(false);
  protected readonly menuUsuario = signal(false);
  protected readonly fechaHoy = new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Lima',
  }).format(new Date());

  private readonly ruta = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects.split('?')[0]),
    ),
    { initialValue: this.router.url.split('?')[0] },
  );

  protected readonly titulo = computed(() => TITULOS.find(([patron]) => patron.test(this.ruta()))?.[1] ?? 'Legajos de Personal');

  protected readonly grupos = computed(() =>
    GRUPOS.map((grupo) => ({
      titulo: grupo.titulo,
      enlaces: grupo.enlaces.filter((enlace) => enlace.permiso === null || this.sesion.tiene(enlace.permiso)),
    })).filter((grupo) => grupo.enlaces.length > 0),
  );

  protected readonly iniciales = computed(() => {
    const nombre = this.sesion.usuario()?.nombreCompleto ?? '';
    return nombre
      .split(/\s+/)
      .filter((parte) => parte.length > 0)
      .slice(0, 2)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join('');
  });

  constructor() {
    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.cerrarMenus());
  }

  protected alternarContraido(): void {
    const nuevo = !this.contraido();
    this.contraido.set(nuevo);
    try {
      localStorage.setItem(CLAVE_CONTRAIDO, nuevo ? '1' : '0');
    } catch {
      return;
    }
  }

  protected alternarMenuUsuario(): void {
    this.menuUsuario.update((abierto) => !abierto);
  }

  protected alPulsarDocumento(evento: MouseEvent): void {
    if (this.menuUsuario() && evento.target instanceof Node && !this.zonaUsuario().nativeElement.contains(evento.target)) {
      this.menuUsuario.set(false);
    }
  }

  protected cerrarMenus(): void {
    this.menuUsuario.set(false);
    this.menuMovil.set(false);
  }

  protected async cerrarSesion(): Promise<void> {
    this.saliendo.set(true);
    try {
      await this.sesion.cerrar();
    } finally {
      this.saliendo.set(false);
      await this.router.navigateByUrl('/login');
    }
  }
}
