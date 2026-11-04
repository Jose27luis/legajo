import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { animate, type AnimationOptions } from 'motion';
import { filter, map } from 'rxjs';
import { CLASE_MOVIMIENTO, TEXTO_ESTADO, TEXTO_MOVIMIENTO, fechaCorta } from '../../core/labels';
import { prefiereMenosMovimiento } from '../../core/motion';
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

interface EnlaceVisible extends EnlaceMenu {
  activo: boolean;
}

interface GrupoVisible {
  titulo: string;
  enlaces: EnlaceVisible[];
  contieneActual: boolean;
}

interface Tooltip {
  texto: string;
  x: number;
  y: number;
}

function enlace(
  ruta: string,
  etiqueta: string,
  icono: NombreIcono,
  permiso: string | null,
  exacto = false,
  activoEn: RegExp | null = null,
): EnlaceMenu {
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
      enlace('/areas', 'Áreas y dependencias', 'catalogos', 'catalogos.gestionar'),
      enlace('/audit', 'Auditoría', 'auditoria', 'auditoria.ver'),
      enlace('/permissions', 'Permisos por sección', 'candado', 'usuarios.gestionar'),
      enlace('/catalogs', 'Catálogos', 'catalogos', 'catalogos.gestionar'),
      enlace('/backups', 'Copias de seguridad', 'respaldo', 'backup.gestionar'),
    ],
  },
];

const CLAVE_CONTRAIDO = 'legajos.menu-contraido';
const CLAVE_GRUPOS = 'legajos.menu-grupos-cerrados';
const MEDIA_ESCRITORIO = '(min-width: 768px)';
const ANCHO_ABIERTO = 256;
const ANCHO_CONTRAIDO = 80;
const SEPARACION_TOOLTIP = 14;

const RESORTE_ANCHO: AnimationOptions = { type: 'spring', stiffness: 300, damping: 32 };
const RESORTE_RESALTADO: AnimationOptions = { type: 'spring', stiffness: 460, damping: 36 };
const RESORTE_BARRA: AnimationOptions = { type: 'spring', stiffness: 380, damping: 30 };
const INSTANTANEO: AnimationOptions = { duration: 0 };

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

function esEscritorio(): boolean {
  return window.matchMedia(MEDIA_ESCRITORIO).matches;
}

function movimiento(opciones: AnimationOptions): AnimationOptions {
  return prefiereMenosMovimiento() ? INSTANTANEO : opciones;
}

function coincide(item: EnlaceMenu, ruta: string): boolean {
  if (item.activoEn !== null && item.activoEn.test(ruta)) {
    return true;
  }
  return item.exacto ? ruta === item.ruta : ruta === item.ruta || ruta.startsWith(`${item.ruta}/`);
}

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
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

  private readonly lateral = viewChild.required<ElementRef<HTMLElement>>('lateral');
  private readonly navegacion = viewChild.required<ElementRef<HTMLElement>>('navegacion');
  private readonly resaltado = viewChild.required<ElementRef<HTMLElement>>('resaltado');

  protected readonly textoEstado = TEXTO_ESTADO;
  protected readonly textoMovimiento = TEXTO_MOVIMIENTO;
  protected readonly claseMovimiento = CLASE_MOVIMIENTO;
  protected readonly fechaCorta = fechaCorta;

  protected readonly saliendo = signal(false);
  protected readonly contraido = signal(leerContraido());
  protected readonly gruposCerrados = signal<readonly string[]>(leerGruposCerrados());
  protected readonly menuMovil = signal(false);
  protected readonly tooltip = signal<Tooltip | null>(null);
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

  protected readonly grupos = computed<GrupoVisible[]>(() => {
    const ruta = this.ruta();
    return MENU.map((grupo) => {
      const enlaces = grupo.enlaces
        .filter((item) => item.permiso === null || this.sesion.tiene(item.permiso))
        .map((item) => ({ ...item, activo: coincide(item, ruta) }));
      return { titulo: grupo.titulo, enlaces, contieneActual: enlaces.some((item) => item.activo) };
    }).filter((grupo) => grupo.enlaces.length > 0);
  });

  protected readonly iniciales = computed(() => {
    const nombre = this.sesion.usuario()?.nombreCompleto ?? '';
    return nombre
      .split(/\s+/)
      .filter((parte) => parte.length > 0)
      .slice(0, 2)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join('');
  });

  private barraAnterior: DOMRect | null = null;
  private resaltadoVisible = false;

  constructor() {
    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.barraAnterior = this.barraActual()?.getBoundingClientRect() ?? null;
      });
    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.cerrarMenus());

    afterRenderEffect(() => {
      this.grupos();
      this.deslizarBarra();
    });

    effect(() => {
      document.body.style.overflow = this.menuMovil() ? 'hidden' : '';
    });
    inject(DestroyRef).onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  protected alternarContraido(): void {
    const lateral = this.lateral().nativeElement;
    const nuevo = !this.contraido();
    this.ocultarTooltip();
    this.ocultarResaltado();
    if (esEscritorio()) {
      lateral.style.width = `${lateral.offsetWidth}px`;
      void animate(lateral, { width: `${nuevo ? ANCHO_CONTRAIDO : ANCHO_ABIERTO}px` }, movimiento(RESORTE_ANCHO)).then(() =>
        lateral.style.removeProperty('width'),
      );
    }
    this.contraido.set(nuevo);
    guardar(CLAVE_CONTRAIDO, nuevo ? '1' : '0');
  }

  protected grupoCerrado(titulo: string): boolean {
    return this.gruposCerrados().includes(titulo);
  }

  protected alternarGrupo(titulo: string): void {
    const actuales = this.gruposCerrados();
    const nuevos = actuales.includes(titulo) ? actuales.filter((cerrado) => cerrado !== titulo) : [...actuales, titulo];
    this.ocultarResaltado();
    this.gruposCerrados.set(nuevos);
    guardar(CLAVE_GRUPOS, JSON.stringify(nuevos));
  }

  protected resaltar(evento: Event, etiqueta: string): void {
    const destino = evento.currentTarget;
    if (!(destino instanceof HTMLElement)) {
      return;
    }
    const navegacion = this.navegacion().nativeElement;
    const marco = navegacion.getBoundingClientRect();
    const caja = destino.getBoundingClientRect();
    const posicion = {
      x: caja.left - marco.left,
      y: caja.top - marco.top + navegacion.scrollTop,
      width: `${caja.width}px`,
      height: `${caja.height}px`,
    };
    const resaltado = this.resaltado().nativeElement;
    if (this.resaltadoVisible) {
      void animate(resaltado, { ...posicion, opacity: 1 }, movimiento(RESORTE_RESALTADO));
    } else {
      void animate(resaltado, posicion, INSTANTANEO);
      void animate(resaltado, { opacity: 1 }, movimiento({ duration: 0.18 }));
      this.resaltadoVisible = true;
    }
    this.mostrarTooltip(evento, etiqueta);
  }

  protected ocultarResaltado(): void {
    if (this.resaltadoVisible) {
      void animate(this.resaltado().nativeElement, { opacity: 0 }, movimiento({ duration: 0.18 }));
      this.resaltadoVisible = false;
    }
  }

  protected mostrarTooltip(evento: Event, texto: string): void {
    const destino = evento.currentTarget;
    if (!this.contraido() || !esEscritorio() || !(destino instanceof HTMLElement)) {
      return;
    }
    const caja = destino.getBoundingClientRect();
    this.tooltip.set({ texto, x: caja.right + SEPARACION_TOOLTIP, y: caja.top + caja.height / 2 });
  }

  protected ocultarTooltip(): void {
    this.tooltip.set(null);
  }

  protected cerrarMenus(): void {
    this.menuMovil.set(false);
    this.ocultarTooltip();
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

  private barraActual(): HTMLElement | null {
    return this.navegacion().nativeElement.querySelector<HTMLElement>('.barra-actual');
  }

  private deslizarBarra(): void {
    const anterior = this.barraAnterior;
    this.barraAnterior = null;
    const barra = this.barraActual();
    if (anterior === null || barra === null) {
      return;
    }
    const desplazamiento = anterior.top - barra.getBoundingClientRect().top;
    if (desplazamiento !== 0) {
      void animate(barra, { y: [desplazamiento, 0] }, movimiento(RESORTE_BARRA));
    }
  }
}
