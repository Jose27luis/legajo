import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { mensajeDeError } from '../../core/errors';
import { numeroSeccion } from '../../core/labels';
import type { PermisoRolSeccion, PermisosSeccion } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SectionAccessService } from '../../services/section-access.service';

@Component({
  selector: 'app-permissions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.css',
})
export class PermissionsComponent {
  private readonly servicio = inject(SectionAccessService);
  private readonly avisos = inject(ToastService);

  protected readonly numeroSeccion = numeroSeccion;
  protected readonly permisos = resource({ loader: () => this.servicio.listar() });
  protected readonly error = computed(() => {
    const error = this.permisos.error();
    return error === undefined ? null : mensajeDeError(error);
  });

  protected readonly roles = linkedSignal<PermisosSeccion | undefined, PermisoRolSeccion[]>({
    source: () => this.permisos.value(),
    computation: (datos) => datos?.roles.map((rol) => ({ ...rol, restringidas: [...rol.restringidas] })) ?? [],
  });
  protected readonly guardando = signal<string | null>(null);

  protected readonly cambios = computed(() => {
    const originales = this.permisos.value()?.roles ?? [];
    return new Set(
      this.roles()
        .filter((rol) => {
          const original = originales.find((item) => item.id === rol.id);
          return original === undefined || [...original.restringidas].sort().join() !== [...rol.restringidas].sort().join();
        })
        .map((rol) => rol.id),
    );
  });

  protected permitida(rol: PermisoRolSeccion, numero: number): boolean {
    return !rol.restringidas.includes(numero);
  }

  protected alternar(rolId: string, numero: number): void {
    this.roles.update((roles) =>
      roles.map((rol) =>
        rol.id !== rolId || rol.bloqueado
          ? rol
          : {
              ...rol,
              restringidas: rol.restringidas.includes(numero)
                ? rol.restringidas.filter((item) => item !== numero)
                : [...rol.restringidas, numero],
            },
      ),
    );
  }

  protected async guardar(rol: PermisoRolSeccion): Promise<void> {
    this.guardando.set(rol.id);
    try {
      const actualizado = await this.servicio.actualizar(
        rol.id,
        [...rol.restringidas].sort((a, b) => a - b),
      );
      this.permisos.update((datos) =>
        datos === undefined ? datos : { ...datos, roles: datos.roles.map((item) => (item.id === actualizado.id ? actualizado : item)) },
      );
      this.avisos.exito(`Permisos de ${rol.nombre} guardados.`);
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.guardando.set(null);
    }
  }
}
