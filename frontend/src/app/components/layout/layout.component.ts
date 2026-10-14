import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { CLASE_MOVIMIENTO, TEXTO_ESTADO, TEXTO_MOVIMIENTO, fechaCorta } from '../../core/labels';
import { SessionService } from '../../core/session.service';
import { SelectedWorkerService, type TrabajadorElegido } from '../../services/selected-worker.service';
import { BrandComponent } from '../brand/brand.component';
import { DossierDialogComponent } from '../dossier-dialog/dossier-dialog.component';
import { GlobalSearchComponent } from '../global-search/global-search.component';
import { IconComponent, type NombreIcono } from '../icon/icon.component';
import { MovementDialogComponent } from '../movement-dialog/movement-dialog.component';
import { ToastComponent } from '../toast/toast.component';

interface EnlaceMenu {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
  exacto: boolean;
  permiso: string | null;
  activoEn: RegExp | null;
}

interface GrupoMenu {
  titulo: string;
  enlaces: EnlaceMenu[];
}

function enlace(ruta: string, etiqueta: string, icono: NombreIcono, permiso: string | null, exacto = false, activoEn: RegExp | null = null): EnlaceMenu {
  return { ruta, etiqueta, icono, exacto, permiso, activoEn };
}

const RUTA_LEGAJO = /^\/workers\/(?!import)[^/]+/;

const MENU: readonly GrupoMenu[] = [
  {
    titulo: 'Menú principal',
    enlaces: [
      enlace('/', 'Panel principal', 'inicio', null, true),
      enlace('/workers', 'Trabajadores', 'personal', 'personal.ver', true),
      enlace('/legajos', 'Legajos digitales', 'legajo', 'personal.ver', true, RUTA_LEGAJO),
      enlace('/search', 'Buscar documentos', 'buscar', 'documentos.ver'),
      enlace('/alerts', 'Alertas de vencimiento', 'alerta', 'reportes.ver'),
      enlace('/import', 'Importar Excel / CSV', 'carga', 'personal.editar'),
      enlace('/bulk-upload', 'Carga masiva de PDF', 'carga', 'carga_masiva.usar'),
    ],
  },
  {
    titulo: 'Reportes',
    enlaces: [
      enlace('/reports', 'Generar reportes', 'reportes', 'reportes.ver'),
      enlace('/statistics', 'Estadísticas del personal', 'estadisticas', 'reportes.ver'),
    ],
  },
  {
    titulo: 'Administración',
    enlaces: [
      enlace('/profile', 'Mi perfil', 'perfil', null),
      enlace('/users', 'Usuarios', 'usuarios', 'usuarios.gestionar'),
      enlace('/audit', 'Auditoría', 'auditoria', 'auditoria.ver'),
      enlace('/permissions', 'Permisos por sección', 'candado', 'usuarios.gestionar'),
      enlace('/catalogs', 'Catálogos', 'catalogos', 'catalogos.gestionar'),
      enlace('/backups', 'Copias de seguridad', 'respaldo', 'backup.gestionar'),
    ],
  },
];

const CLAVE_CONTRAIDO = 'legajos.menu-contraido';
const CLAVE_GRUPOS = 'legajos.menu-grupos-cerrados';

function leerContraido(): boolean {
  try {
    return localStorage.getItem(CLAVE_CONTRAIDO) === '1';
  } catch {
    return false;
  }
}

function leerGruposCerrados(): readonly string[] {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(CLAVE_GRUPOS) ?? '[]');
    return Array.isArray(guardado) ? guardado.filter((titulo): titulo is string => typeof titulo === 'string') : [];
  } catch {
    return [];
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    return;
  }
}

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    BrandComponent,
    GlobalSearchComponent,
    IconComponent,
    ToastComponent,
    DossierDialogComponent,
    MovementDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
  host: {
    '(document:keydown.escape)': 'cerrarMenus()',
  },
})
export class LayoutComponent {
  private readonly router = inject(Router);
  private readonly trabajadorElegido = inject(SelectedWorkerService);
  protected readonly sesion = inject(SessionService);

  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly claseMovimiento = CLASE_MOVIMIENTO;
  protected readonly fechaCorta = fechaCorta;

  protected readonly saliendo = signal(false);
  protected readonly contraido = signal(leerContraido());
  protected readonly gruposCerrados = signal<readonly string[]>(leerGruposCerrados());
  protected readonly menuMovil = signal(false);
  protected readonly paraExpediente = signal<TrabajadorElegido | null>(null);
  protected readonly paraMovimiento = signal<string | null>(null);
  protected readonly fechaHoy = new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Lima',
  }).format(new Date());

  protected readonly ruta = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects.split('?')[0]),
    ),
    { initialValue: this.router.url.split('?')[0] },
  );

  protected readonly elegido = this.trabajadorElegido.actual;
  protected readonly enLegajo = computed(() => RUTA_LEGAJO.test(this.ruta()) && this.elegido() !== null);

  protected readonly grupos = computed<GrupoMenu[]>(() =>
    MENU.map((grupo) => ({
      titulo: grupo.titulo,
      enlaces: grupo.enlaces.filter((item) => item.permiso === null || this.sesion.tiene(item.permiso)),
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

  protected activoPorRuta(item: EnlaceMenu): boolean {
    return item.activoEn !== null && item.activoEn.test(this.ruta());
  }

  protected alternarContraido(): void {
    const nuevo = !this.contraido();
    this.contraido.set(nuevo);
    guardar(CLAVE_CONTRAIDO, nuevo ? '1' : '0');
  }

  protected grupoCerrado(titulo: string): boolean {
    return this.gruposCerrados().includes(titulo);
  }

  protected alternarGrupo(titulo: string): void {
    const actuales = this.gruposCerrados();
    const nuevos = actuales.includes(titulo) ? actuales.filter((cerrado) => cerrado !== titulo) : [...actuales, titulo];
    this.gruposCerrados.set(nuevos);
    guardar(CLAVE_GRUPOS, JSON.stringify(nuevos));
  }

  protected cerrarMenus(): void {
    this.menuMovil.set(false);
  }

  protected cambiarTrabajador(): void {
    this.trabajadorElegido.limpiar();
    void this.router.navigateByUrl('/legajos');
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
}
