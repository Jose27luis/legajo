import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { distinctUntilChanged, filter, map, of, switchMap, timer } from 'rxjs';

const ESPERA_MS = 150;

@Component({
  selector: 'app-navigation-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navigation-progress.component.html',
  styleUrl: './navigation-progress.component.css',
})
export class NavigationProgressComponent {
  protected readonly visible = toSignal(
    inject(Router).events.pipe(
      filter(
        (evento) =>
          evento instanceof NavigationStart ||
          evento instanceof NavigationEnd ||
          evento instanceof NavigationCancel ||
          evento instanceof NavigationError,
      ),
      map((evento) => evento instanceof NavigationStart),
      distinctUntilChanged(),
      switchMap((navegando) => (navegando ? timer(ESPERA_MS).pipe(map(() => true)) : of(false))),
    ),
    { initialValue: false },
  );
}
