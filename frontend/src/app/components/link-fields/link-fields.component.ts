import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule, type FormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '../../core/errors';
import { SessionService } from '../../core/session.service';
import { LinkOptionsService } from '../../services/link-options.service';
import type { CamposVinculo } from './link-form';

let siguienteId = 1;

@Component({
  selector: 'app-link-fields',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-fields.component.html',
  styleUrl: './link-fields.component.css',
})
export class LinkFieldsComponent implements OnInit {
  private readonly servicio = inject(LinkOptionsService);
  protected readonly sesion = inject(SessionService);

  readonly grupo = input.required<FormGroup<CamposVinculo>>();
  readonly etiquetaReferencia = input('Documento de sustento');

  protected readonly prefijo = `vinculo-${siguienteId++}`;
  protected readonly opciones = this.servicio.opciones;
  protected readonly error = signal<string | null>(null);
  protected readonly faltanCatalogos = computed(() => {
    const opciones = this.opciones();
    return opciones !== null && (opciones.cargos.length === 0 || opciones.areas.length === 0);
  });

  ngOnInit(): void {
    this.servicio.cargar(true).catch((error: unknown) => this.error.set(mensajeDeError(error)));
  }

  protected invalido(campo: keyof CamposVinculo): boolean {
    const control = this.grupo().controls[campo];
    return control.touched && control.invalid;
  }
}
