import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SearchSelectComponent, type OpcionBuscable } from '../../../src/app/components/search-select/search-select.component';

const OPCIONES: OpcionBuscable[] = [
  { valor: 1, etiqueta: 'P.S. BOCA MANU', detalle: 'Microred Salvación' },
  { valor: 2, etiqueta: 'C.S. SALVACION', detalle: 'Microred Salvación' },
  { valor: 3, etiqueta: 'OFICINA DE PERSONAL', detalle: 'DIRESA Madre de Dios' },
];

@Component({
  imports: [ReactiveFormsModule, SearchSelectComponent],
  template: `<app-search-select idCampo="prueba" [formControl]="control" [opciones]="opciones" [buscador]="true" />`,
})
class Anfitrion {
  readonly control = new FormControl<number | null>(null);
  readonly opciones = OPCIONES;
}

const ESTADOS: OpcionBuscable[] = [
  { valor: null, etiqueta: 'Todos' },
  { valor: 'ACTIVO', etiqueta: 'Activos' },
  { valor: 'BLOQUEADO', etiqueta: 'Bloqueados', deshabilitada: true },
  { valor: 'CESADO', etiqueta: 'Cesados' },
];

@Component({
  imports: [SearchSelectComponent],
  template: `<app-search-select idCampo="estado" [opciones]="opciones" [seleccion]="estado" (cambio)="cambios.push($event)" />`,
})
class AnfitrionFiltro {
  readonly opciones = ESTADOS;
  readonly cambios: (string | number | null)[] = [];
  estado: string | null = 'ACTIVO';
}

function preparar() {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  const elemento = fixture.nativeElement as HTMLElement;
  const entrada = elemento.querySelector('input');
  if (entrada === null) {
    throw new Error('No se encontró el campo');
  }
  return { fixture, elemento, entrada };
}

function teclear(entrada: HTMLInputElement, tecla: string): void {
  entrada.dispatchEvent(new KeyboardEvent('keydown', { key: tecla, bubbles: true }));
}

describe('SearchSelectComponent', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('muestra todas las opciones al enfocar y filtra sin importar tildes', () => {
    const { fixture, elemento, entrada } = preparar();
    entrada.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(elemento.querySelectorAll('[role="option"]')).toHaveLength(3);

    entrada.value = 'salvación';
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(elemento.querySelectorAll('[role="option"]')).toHaveLength(2);

    entrada.value = 'personal';
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(elemento.querySelector('[role="option"] .etiqueta')?.textContent?.trim()).toBe('OFICINA DE PERSONAL');
  });

  it('elige con el teclado y actualiza el formulario', () => {
    const { fixture, entrada } = preparar();
    entrada.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    teclear(entrada, 'ArrowDown');
    teclear(entrada, 'ArrowDown');
    teclear(entrada, 'Enter');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe(2);
    expect(entrada.value).toBe('C.S. SALVACION · Microred Salvación');
    expect(fixture.componentInstance.control.touched).toBe(true);
  });

  it('elige con el mouse', () => {
    const { fixture, elemento, entrada } = preparar();
    entrada.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    elemento.querySelectorAll('[role="option"]')[2]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe(3);
    expect(elemento.querySelector('[role="listbox"]')).toBeNull();
  });

  it('muestra el valor que ya tenía el formulario y avisa cuando nada coincide', () => {
    const { fixture, elemento, entrada } = preparar();
    fixture.componentInstance.control.setValue(1);
    fixture.detectChanges();
    expect(entrada.value).toBe('P.S. BOCA MANU · Microred Salvación');

    entrada.dispatchEvent(new Event('focus'));
    entrada.value = 'hospital';
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(elemento.querySelector('.vacio')?.textContent).toContain('hospital');
  });

  it('cierra con Escape sin cambiar el valor', () => {
    const { fixture, elemento, entrada } = preparar();
    entrada.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    teclear(entrada, 'ArrowDown');
    teclear(entrada, 'Escape');
    fixture.detectChanges();
    expect(elemento.querySelector('[role="listbox"]')).toBeNull();
    expect(fixture.componentInstance.control.value).toBeNull();
  });

  it('respeta el estado deshabilitado del formulario', () => {
    const { fixture, elemento, entrada } = preparar();
    fixture.componentInstance.control.disable();
    fixture.detectChanges();
    entrada.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(entrada.disabled).toBe(true);
    expect(elemento.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('SearchSelectComponent como lista sin buscador', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  function prepararFiltro() {
    const fixture = TestBed.createComponent(AnfitrionFiltro);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;
    const entrada = elemento.querySelector('input');
    if (entrada === null) {
      throw new Error('No se encontró el campo');
    }
    return { fixture, elemento, entrada };
  }

  it('muestra el valor recibido y no permite escribir con pocas opciones', () => {
    const { elemento, entrada } = prepararFiltro();
    expect(entrada.value).toBe('Activos');
    expect(entrada.readOnly).toBe(true);
    expect(elemento.querySelector('.lupa')).toBeNull();
  });

  it('abre al hacer clic, salta las opciones deshabilitadas y emite el cambio', () => {
    const { fixture, entrada } = prepararFiltro();
    entrada.click();
    fixture.detectChanges();
    teclear(entrada, 'ArrowDown');
    teclear(entrada, 'Enter');
    fixture.detectChanges();
    expect(fixture.componentInstance.cambios).toEqual(['CESADO']);
    expect(entrada.value).toBe('Cesados');
  });

  it('permite elegir la opción sin valor y no emite si se repite la misma', () => {
    const { fixture, elemento, entrada } = prepararFiltro();
    entrada.click();
    fixture.detectChanges();
    elemento.querySelectorAll('[role="option"]')[1]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    entrada.click();
    fixture.detectChanges();
    elemento.querySelectorAll('[role="option"]')[0]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.cambios).toEqual([null]);
    expect(entrada.value).toBe('Todos');
  });

  it('ignora el clic en una opción deshabilitada', () => {
    const { fixture, elemento, entrada } = prepararFiltro();
    entrada.click();
    fixture.detectChanges();
    elemento.querySelectorAll('[role="option"]')[2]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.cambios).toEqual([]);
    expect(entrada.value).toBe('Activos');
  });
});
