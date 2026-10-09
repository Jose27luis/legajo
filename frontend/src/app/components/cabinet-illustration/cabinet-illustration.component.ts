import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, viewChild } from '@angular/core';
import { animate, stagger } from 'motion';
import { prefiereMenosMovimiento } from '../../core/motion';

const CURVA_SUAVE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Cajon {
  y: number;
  rango: string;
}

@Component({
  selector: 'app-cabinet-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cabinet-illustration.component.html',
  styleUrl: './cabinet-illustration.component.css',
})
export class CabinetIllustrationComponent implements AfterViewInit {
  private readonly lienzo = viewChild.required<ElementRef<SVGSVGElement>>('lienzo');

  protected readonly cajonesCerrados: readonly Cajon[] = [
    { y: 88, rango: '05 – 09' },
    { y: 150, rango: '10 – 13' },
  ];

  ngAfterViewInit(): void {
    const lienzo = this.lienzo().nativeElement;
    const frente = lienzo.querySelector<SVGGElement>('.cajon-abierto');
    const carpetas = lienzo.querySelectorAll<SVGGElement>('.carpeta');
    if (frente === null) {
      return;
    }
    if (prefiereMenosMovimiento()) {
      frente.style.transform = 'translateY(12px) scale(1.045)';
      carpetas.forEach((carpeta) => {
        carpeta.style.opacity = '1';
      });
      return;
    }
    animate(
      frente,
      { transform: ['translateY(0px) scale(1)', 'translateY(12px) scale(1.045)'] },
      { delay: 0.55, duration: 0.7, ease: CURVA_SUAVE },
    );
    animate(
      carpetas,
      { opacity: [0, 1], transform: ['translateY(22px)', 'translateY(0px)'] },
      { delay: stagger(0.1, { startDelay: 0.85 }), duration: 0.6, ease: CURVA_SUAVE },
    );
  }
}
