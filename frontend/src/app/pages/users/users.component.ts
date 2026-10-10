import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent } from '../../components/dialog/dialog.component';
import { mensajeDeError } from '../../core/errors';
import { fechaHora, normalizarTexto } from '../../core/format';
import type { ClaveTemporal, Rol, Usuario } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { UsersService } from '../../services/users.service';

type CampoUsuario = 'usuario' | 'nombreCompleto' | 'correo' | 'rolId';

interface Confirmacion {
  tipo: 'desactivar' | 'restablecer';
  usuario: Usuario;
}

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {
  private readonly servicio = inject(UsersService);
  private readonly avisos = inject(ToastService);
  private readonly sesion = inject(SessionService);

  protected readonly fechaHora = fechaHora;
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly roles = signal<Rol[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly busqueda = signal('');

  protected readonly filtrados = computed(() => {
    const termino = normalizarTexto(this.busqueda());
    if (termino === '') {
      return this.usuarios();
    }
    return this.usuarios().filter((usuario) =>
      normalizarTexto(`${usuario.nombreCompleto} ${usuario.usuario} ${usuario.correo} ${usuario.rol.nombre}`).includes(termino),
    );
  });

  protected readonly resumen = computed(() => {
    const lista = this.usuarios();
    return {
      total: lista.length,
      activos: lista.filter((usuario) => usuario.activo).length,
      bloqueados: lista.filter((usuario) => usuario.bloqueadoHasta !== null).length,
    };
  });

  protected readonly formularioAbierto = signal(false);
  protected readonly editando = signal<Usuario | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly formulario = new FormGroup({
    usuario: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[a-z0-9._-]{4,30}$/)],
    }),
    nombreCompleto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(120)],
    }),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(120)],
    }),
    rolId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly claveGenerada = signal<ClaveTemporal | null>(null);
  protected readonly copiada = signal(false);

  protected readonly confirmacion = signal<Confirmacion | null>(null);
  protected readonly procesando = signal(false);

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      const [usuarios, roles] = await Promise.all([this.servicio.listar(), this.servicio.listarRoles()]);
      this.usuarios.set(usuarios);
      this.roles.set(roles);
    } catch (error: unknown) {
      this.errorCarga.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected actualizarBusqueda(evento: Event): void {
    if (evento.target instanceof HTMLInputElement) {
      this.busqueda.set(evento.target.value);
    }
  }

  protected esPropio(usuario: Usuario): boolean {
    return usuario.id === this.sesion.usuario()?.id;
  }

  protected nuevo(): void {
    const operador = this.roles().find((rol) => rol.nombre === 'Operador');
    this.editando.set(null);
    this.errorFormulario.set(null);
    this.formulario.reset({ usuario: '', nombreCompleto: '', correo: '', rolId: operador?.id ?? '' });
    this.formulario.controls.usuario.enable();
    this.formularioAbierto.set(true);
  }

  protected editar(usuario: Usuario): void {
    this.editando.set(usuario);
    this.errorFormulario.set(null);
    this.formulario.reset({
      usuario: usuario.usuario,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      rolId: usuario.rol.id,
    });
    this.formulario.controls.usuario.disable();
    this.formularioAbierto.set(true);
  }

  protected cerrarFormulario(): void {
    if (!this.guardando()) {
      this.formularioAbierto.set(false);
    }
  }

  protected invalido(campo: CampoUsuario): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  protected descripcionRol(): string {
    const rolId = this.formulario.controls.rolId.value;
    return this.roles().find((rol) => rol.id === rolId)?.descripcion ?? '';
  }

  protected async guardar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.errorFormulario.set('Revisa los campos marcados.');
      return;
    }
    this.guardando.set(true);
    this.errorFormulario.set(null);
    const { usuario, nombreCompleto, correo, rolId } = this.formulario.getRawValue();
    const datos = { nombreCompleto: nombreCompleto.trim(), correo: correo.trim().toLowerCase(), rolId };
    try {
      const actual = this.editando();
      if (actual === null) {
        const resultado = await this.servicio.crear({ ...datos, usuario: usuario.trim().toLowerCase() });
        this.usuarios.update((lista) => [...lista, resultado.usuario]);
        this.formularioAbierto.set(false);
        this.mostrarClave(resultado);
        this.avisos.exito(`Cuenta ${resultado.usuario.usuario} creada`);
      } else {
        const actualizado = await this.servicio.editar(actual.id, datos);
        this.reemplazar(actualizado);
        this.formularioAbierto.set(false);
        this.avisos.exito('Cambios guardados');
      }
    } catch (error: unknown) {
      this.errorFormulario.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async activar(usuario: Usuario): Promise<void> {
    try {
      this.reemplazar(await this.servicio.activar(usuario.id));
      this.avisos.exito(`Cuenta ${usuario.usuario} activada`);
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    }
  }

  protected async desbloquear(usuario: Usuario): Promise<void> {
    try {
      this.reemplazar(await this.servicio.desbloquear(usuario.id));
      this.avisos.exito(`Cuenta ${usuario.usuario} desbloqueada`);
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    }
  }

  protected pedirConfirmacion(tipo: Confirmacion['tipo'], usuario: Usuario): void {
    this.confirmacion.set({ tipo, usuario });
  }

  protected cerrarConfirmacion(): void {
    if (!this.procesando()) {
      this.confirmacion.set(null);
    }
  }

  protected async confirmar(): Promise<void> {
    const pendiente = this.confirmacion();
    if (pendiente === null) {
      return;
    }
    this.procesando.set(true);
    try {
      if (pendiente.tipo === 'desactivar') {
        this.reemplazar(await this.servicio.desactivar(pendiente.usuario.id));
        this.avisos.exito(`Cuenta ${pendiente.usuario.usuario} desactivada`);
      } else {
        const resultado = await this.servicio.restablecerClave(pendiente.usuario.id);
        this.reemplazar(resultado.usuario);
        this.mostrarClave(resultado);
      }
      this.confirmacion.set(null);
    } catch (error: unknown) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.procesando.set(false);
    }
  }

  protected async copiarClave(): Promise<void> {
    const generada = this.claveGenerada();
    if (generada === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(generada.claveTemporal);
      this.copiada.set(true);
    } catch {
      this.avisos.error('No se pudo copiar. Selecciona la contraseña y cópiala manualmente.');
    }
  }

  protected cerrarClave(): void {
    this.claveGenerada.set(null);
  }

  private mostrarClave(resultado: ClaveTemporal): void {
    this.copiada.set(false);
    this.claveGenerada.set(resultado);
  }

  private reemplazar(actualizado: Usuario): void {
    this.usuarios.update((lista) => lista.map((usuario) => (usuario.id === actualizado.id ? actualizado : usuario)));
  }
}
