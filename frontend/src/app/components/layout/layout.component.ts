import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, resource, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { TEXTO_ESTADO, TEXTO_MOVIMIENTO, numeroSeccion } from '../../core/labels';
import { SessionService } from '../../core/session.service';
import { FilterOptionsService } from '../../services/filter-options.service';
import { SelectedWorkerService } from '../../services/selected-worker.service';
import { BrandComponent } from '../brand/brand.component';
import { GlobalSearchComponent } from '../global-search/global-search.component';
import { IconComponent, type NombreIcono } from '../icon/icon.component';
import { ToastComponent } from '../toast/toast.component';

interface EnlaceMenu {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono | null;
  numero: string | null;
  exacto: boolean;
  permiso: string | null;
}

interface GrupoMenu {
  titulo: string;
  enlaces: EnlaceMenu[];
}

function enlace(ruta: string, etiqueta: string, icono: NombreIcono, permiso: string | null, exacto = false): EnlaceMenu {
  return { ruta, etiqueta, icono, numero: null, exacto, permiso };
}

const NAVEGACION: readonly EnlaceMenu[] = [
  enlace('/', 'Panel general y estadísticas', 'inicio', null, true),
  enlace('/workers', 'Lista de trabajadores', 'personal', 'personal.ver'),
  enlace('/search', 'Búsqueda avanzada', 'buscar', 'personal.ver'),
  enlace('/bulk-upload', 'Carga masiva', 'carga', 'carga_masiva.usar'),
  enlace('/reports', 'Reportes', 'reportes', 'reportes.ver'),
];

const CUENTA: readonly EnlaceMenu[] = [
  enlace('/profile', 'Mi perfil', 'perfil', null),
  enlace('/users', 'Gestión de usuarios', 'usuarios', 'usuarios.gestionar'),
  enlace('/catalogs', 'Catálogos', 'catalogos', 'catalogos.gestionar'),
];

const TITULOS: readonly [RegExp, string][] = [
  [/^\/$/, 'Panel general'],
  [/^\/workers\/[^/]+\/record$/, 'Ficha del trabajador'],
  [/^\/workers\/[^/]+\/missing$/, 'Documentos faltantes'],
  [/^\/workers\/[^/]+\/sections\/\d+$/, 'Sección del legajo'],
  [/^\/workers\/[^/]+$/, 'Legajo del trabajador'],
  [/^\/workers$/, 'Lista de trabajadores'],
  [/^\/bulk-upload\/[^/]+$/, 'Lote de carga'],
  [/^\/bulk-upload$/, 'Carga masiva'],
  [/^\/search$/, 'Búsqueda avanzada'],
  [/^\/reports/, 'Reportes'],
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandComponent, GlobalSearchComponent, IconComponent, ToastComponent],
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
  private readonly opciones = inject(FilterOptionsService);
  protected readonly sesion = inject(SessionService);
  private readonly zonaUsuario = viewChild.required<ElementRef<HTMLElement>>('zonaUsuario');

  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;

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

  private readonly trabajadorElegido = inject(SelectedWorkerService);
  protected readonly elegido = this.trabajadorElegido.actual;

  private readonly secciones = resource({
    loader: async () => (await this.opciones.cargar()).secciones,
  });

  protected readonly grupos = computed<GrupoMenu[]>(() => {
    const grupos: GrupoMenu[] = [{ titulo: 'Navegación', enlaces: [...NAVEGACION] }];
    const trabajador = this.elegido();
    if (trabajador !== null && this.sesion.tiene('personal.ver')) {
      grupos.push({ titulo: 'Legajo seleccionado', enlaces: this.enlacesLegajo(trabajador.id) });
    }
    grupos.push({ titulo: 'Cuenta y seguridad', enlaces: [...CUENTA] });
    return grupos
      .map((grupo) => ({
        titulo: grupo.titulo,
        enlaces: grupo.enlaces.filter((enlace) => enlace.permiso === null || this.sesion.tiene(enlace.permiso)),
      }))
      .filter((grupo) => grupo.enlaces.length > 0);
  });

  private enlacesLegajo(id: string): EnlaceMenu[] {
    const base = `/workers/${id}`;
    const enlaces: EnlaceMenu[] = [
      { ruta: base, etiqueta: 'Vista general de las 13 secciones', icono: 'inicio', numero: null, exacto: true, permiso: null },
      { ruta: `${base}/record`, etiqueta: 'Ficha del trabajador', icono: 'perfil', numero: null, exacto: false, permiso: null },
      { ruta: `${base}/missing`, etiqueta: 'Documentos faltantes', icono: 'reportes', numero: null, exacto: false, permiso: 'reportes.ver' },
    ];
    const secciones = this.secciones.hasValue() ? this.secciones.value() : [];
    for (const seccion of secciones) {
      enlaces.push({
        ruta: `${base}/sections/${seccion.numero}`,
        etiqueta: seccion.nombre,
        icono: null,
        numero: numeroSeccion(seccion.numero),
        exacto: false,
        permiso: 'documentos.ver',
      });
    }
    return enlaces;
  }

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
      this.trabajadorElegido.limpiar();
      this.saliendo.set(false);
      await this.router.navigateByUrl('/login');
    }
  }

  protected soltarTrabajador(): void {
    this.trabajadorElegido.limpiar();
  }
}
