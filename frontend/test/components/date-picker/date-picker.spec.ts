import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../src/app/components/date-picker/date-picker.component';

@Component({
  imports: [ReactiveFormsModule, DatePickerComponent],
  template: `<app-date-picker idCampo="prueba" [formControl]="control" min="2020-01-01" max="2020-12-31" />`,
})
class Anfitrion {
  readonly control = new FormControl('2020-03-15', { nonNullable: true });
}

@Component({
  imports: [DatePickerComponent],
  template: `<app-date-picker idCampo="filtro" [fecha]="fecha" (cambio)="cambios.push($event)" />`,
})
class AnfitrionFiltro {
  readonly cambios: string[] = [];
  fecha = '';
}

function preparar() {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  const elemento = fixture.nativeElement as HTMLElement;
  const entrada = elemento.querySelector('input');
  const boton = elemento.querySelector<HTMLButtonElement>('button.abrir');
  if (entrada === null || boton === null) {
    throw new Error('No se encontró el campo');
  }
  return { fixture, elemento, entrada, boton };
}

function escribir(entrada: HTMLInputElement, texto: string): void {
  entrada.value = texto;
  entrada.dispatchEvent(new Event('input'));
}

describe('DatePickerComponent', () => {
  it('muestra el valor del formulario como dd/mm/aaaa', () => {
    const { entrada } = preparar();
    expect(entrada.value).toBe('15/03/2020');
  });

  it('agrega las barras al escribir y actualiza el formulario con la fecha completa', () => {
    const { fixture, entrada } = preparar();
    escribir(entrada, '0807');
    fixture.detectChanges();
    expect(entrada.value).toBe('08/07');
    expect(fixture.componentInstance.control.value).toBe('2020-03-15');

    escribir(entrada, '08072020');
    fixture.detectChanges();
    expect(entrada.value).toBe('08/07/2020');
    expect(fixture.componentInstance.control.value).toBe('2020-07-08');
  });

  it('no acepta fechas inexistentes ni fuera del rango permitido', () => {
    const { fixture, entrada } = preparar();
    escribir(entrada, '31022020');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe('2020-03-15');
    expect(entrada.getAttribute('aria-invalid')).toBe('true');

    escribir(entrada, '01012021');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe('2020-03-15');
  });

  it('borrar el texto deja la fecha vacía', () => {
    const { fixture, entrada } = preparar();
    escribir(entrada, '');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe('');
  });

  it('abre el calendario en el mes de la fecha y elige un día con el ratón', () => {
    const { fixture, elemento, boton, entrada } = preparar();
    boton.click();
    fixture.detectChanges();
    expect(elemento.querySelector('.titulo')?.textContent?.trim()).toBe('marzo 2020');
    expect(elemento.querySelector('.dia.elegido')?.textContent?.trim()).toBe('15');

    elemento.querySelector<HTMLButtonElement>('#prueba-dia-2020-03-20')?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe('2020-03-20');
    expect(entrada.value).toBe('20/03/2020');
    expect(elemento.querySelector('[role="dialog"]')).toBeNull();
  });

  it('deshabilita los días fuera del rango', () => {
    const { fixture, elemento, boton } = preparar();
    boton.click();
    fixture.detectChanges();
    const anterior = elemento.querySelector<HTMLButtonElement>('button.paso');
    anterior?.click();
    anterior?.click();
    anterior?.click();
    fixture.detectChanges();
    expect(elemento.querySelector('.titulo')?.textContent?.trim()).toBe('diciembre 2019');
    expect(elemento.querySelector<HTMLButtonElement>('#prueba-dia-2019-12-31')?.disabled).toBe(true);
    expect(elemento.querySelector<HTMLButtonElement>('#prueba-dia-2020-01-01')?.disabled).toBe(false);
  });

  it('se mueve por los días con el teclado', () => {
    const { fixture, elemento, boton } = preparar();
    boton.click();
    fixture.detectChanges();
    const dia = elemento.querySelector<HTMLButtonElement>('#prueba-dia-2020-03-15');
    dia?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(elemento.querySelector('#prueba-dia-2020-03-22')?.getAttribute('tabindex')).toBe('0');

    elemento.querySelector('#prueba-dia-2020-03-22')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    fixture.detectChanges();
    expect(elemento.querySelector('.titulo')?.textContent?.trim()).toBe('abril 2020');
  });

  it('cambia de mes y de año desde las vistas de meses y años', () => {
    const { fixture, elemento, boton } = preparar();
    boton.click();
    fixture.detectChanges();
    elemento.querySelector<HTMLButtonElement>('button.titulo')?.click();
    fixture.detectChanges();
    expect(elemento.querySelectorAll('.celda')).toHaveLength(12);

    const septiembre = [...elemento.querySelectorAll<HTMLButtonElement>('.celda')].find((celda) => celda.textContent?.trim() === 'sep');
    septiembre?.click();
    fixture.detectChanges();
    expect(elemento.querySelector('.titulo')?.textContent?.trim()).toBe('septiembre 2020');
  });

  it('emite el cambio cuando se usa sin formulario', () => {
    const fixture = TestBed.createComponent(AnfitrionFiltro);
    fixture.detectChanges();
    const entrada = (fixture.nativeElement as HTMLElement).querySelector('input');
    if (entrada === null) {
      throw new Error('No se encontró el campo');
    }
    escribir(entrada, '01022024');
    fixture.detectChanges();
    expect(fixture.componentInstance.cambios).toEqual(['2024-02-01']);
  });
});
