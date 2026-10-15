import { TestBed } from '@angular/core/testing';
import { SkeletonComponent } from '../../../src/app/components/skeleton/skeleton.component';
import { SpinnerComponent } from '../../../src/app/components/spinner/spinner.component';

describe('SkeletonComponent', () => {
  function crear(forma: 'filas' | 'lista' | 'tarjetas' | 'texto' | 'ficha', cantidad: number, columnas = 4) {
    const fixture = TestBed.createComponent(SkeletonComponent);
    fixture.componentRef.setInput('forma', forma);
    fixture.componentRef.setInput('cantidad', cantidad);
    fixture.componentRef.setInput('columnas', columnas);
    fixture.componentRef.setInput('texto', 'Cargando trabajadores');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dibuja tantas filas y celdas como se piden', () => {
    const elemento = crear('filas', 3, 5);
    expect(elemento.querySelectorAll('.fila')).toHaveLength(3);
    expect(elemento.querySelectorAll('.fila .esqueleto')).toHaveLength(15);
  });

  it('dibuja una lista con avatar por elemento', () => {
    expect(crear('lista', 4).querySelectorAll('.item .avatar')).toHaveLength(4);
  });

  it('dibuja tarjetas y la ficha del trabajador', () => {
    expect(crear('tarjetas', 2).querySelectorAll('.tarjeta-esqueleto')).toHaveLength(2);
    expect(crear('ficha', 3).querySelectorAll('.persona .avatar.grande')).toHaveLength(1);
  });

  it('se anuncia como contenido que está cargando', () => {
    const elemento = crear('texto', 2);
    expect(elemento.getAttribute('role')).toBe('status');
    expect(elemento.getAttribute('aria-busy')).toBe('true');
    expect(elemento.getAttribute('aria-label')).toBe('Cargando trabajadores');
    expect(elemento.classList).toContain('forma-texto');
  });
});

describe('SpinnerComponent', () => {
  it('muestra el texto y lo usa como nombre accesible', () => {
    const fixture = TestBed.createComponent(SpinnerComponent);
    fixture.componentRef.setInput('texto', 'Buscando');
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.textContent?.trim()).toBe('Buscando');
    expect(elemento.getAttribute('aria-label')).toBe('Buscando');
    expect(elemento.querySelector('.girador')).not.toBeNull();
  });

  it('usa Cargando como nombre cuando no hay texto', () => {
    const fixture = TestBed.createComponent(SpinnerComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).getAttribute('aria-label')).toBe('Cargando');
  });
});
