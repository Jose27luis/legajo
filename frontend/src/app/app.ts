import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationProgressComponent } from './components/navigation-progress/navigation-progress.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavigationProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
