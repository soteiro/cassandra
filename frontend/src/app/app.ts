import { Component, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoadingService } from './shared/services/loading.service';
import { LoadingIndicator } from './shared/ui/loading-indicator/loading-indicator';
import { ToastContainer } from './shared/ui/toast-container/toast-container';
import { BackButtonService } from './core/platform/back-button.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [RouterOutlet, ToastContainer, LoadingIndicator],
})
export class App {
  private readonly backButtonService = inject(BackButtonService);
  protected readonly title = signal('Home');

  constructor() {
    const loading = inject(LoadingService);
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) loading.startNavigation(event.id);
        else if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError ||
          event instanceof NavigationSkipped
        ) {
          loading.finishNavigation(event.id);
        }
      });
  }
}
