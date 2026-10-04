import { Injectable, inject, NgZone, effect } from '@angular/core';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ToastService } from './toast.service';

export interface BackButtonHandler {
  id: number;
  priority: number;
  fn: () => boolean | void | Promise<boolean | void>;
}

@Injectable({
  providedIn: 'root',
})
export class BackButtonService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly ngZone = inject(NgZone);
  private readonly toastService = inject(ToastService);

  private handlers: BackButtonHandler[] = [];
  private nextHandlerId = 1;
  private history: string[] = [];
  private isPopstate = false;
  private lastBackPressTime = 0;
  private readonly exitWindowMs = 2000;

  constructor() {
    this.initHistoryTracking();
    this.initNativeListener();
  }

  private initHistoryTracking(): void {
    const initialUrl = this.getCurrentCleanUrl();
    if (initialUrl) {
      this.history.push(initialUrl);
    }

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.isPopstate = event.navigationTrigger === 'popstate';
      } else if (event instanceof NavigationEnd) {
        const cleanUrl = this.cleanUrl(event.urlAfterRedirects || event.url);
        if (this.isPopstate) {
          this.history.pop();
          if (this.history.length === 0) {
            this.history.push(cleanUrl);
          }
        } else {
          const last = this.history[this.history.length - 1];
          if (last !== cleanUrl) {
            this.history.push(cleanUrl);
            if (this.history.length > 50) {
              this.history.shift();
            }
          }
        }
        this.isPopstate = false;
      }
    });
  }

  private async initNativeListener(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await App.addListener('backButton', ({ canGoBack }) => {
        this.ngZone.run(() => {
          this.handleBackButton(canGoBack);
        });
      });
    } catch (err) {
      console.warn('Could not register Capacitor backButton listener:', err);
    }
  }

  /**
   * Register a custom handler when the phone back button is pressed.
   * Higher priority executes first. Equal priority uses LIFO order.
   * If a handler returns false, the event continues to lower priority handlers or navigation.
   */
  register(
    priority: number,
    fn: () => boolean | void | Promise<boolean | void>
  ): () => void {
    const id = this.nextHandlerId++;
    const handler: BackButtonHandler = { id, priority, fn };

    this.handlers.unshift(handler);
    this.handlers.sort((a, b) => b.priority - a.priority);

    return () => {
      this.handlers = this.handlers.filter((h) => h.id !== id);
    };
  }

  /**
   * Helper that links a boolean signal (e.g. modal isOpen) to a back button action.
   * Must be called in an injection context (field initializer or constructor).
   */
  registerEffect(
    isOpenSignal: () => boolean,
    action: () => boolean | void | Promise<boolean | void>,
    priority = 80
  ) {
    return effect((onCleanup) => {
      if (isOpenSignal()) {
        const unregister = this.register(priority, action);
        onCleanup(() => unregister());
      }
    });
  }

  /**
   * Handles the back button press. Can be called manually for testing.
   */
  async handleBackButton(canGoBack?: boolean): Promise<void> {
    // 1. Check registered overlay/modal handlers in priority order
    for (const handler of this.handlers) {
      try {
        const result = await handler.fn();
        if (result !== false) {
          return;
        }
      } catch (err) {
        console.error('Error in back button handler:', err);
        return;
      }
    }

    // 2. Navigation back
    await this.handleNavigationBack(canGoBack);
  }

  private async handleNavigationBack(_canGoBack?: boolean): Promise<void> {
    const currentUrl = this.getCurrentCleanUrl();

    // If at root page (Home or Login), prompt to exit
    if (this.isRootRoute(currentUrl)) {
      this.handleRootExit();
      return;
    }

    // If we have history inside the app, go back
    if (this.history.length > 1) {
      this.location.back();
      return;
    }

    // Fallback navigation if directly accessed or history is empty
    this.handleFallbackNavigation(currentUrl);
  }

  private handleFallbackNavigation(currentUrl: string): void {
    if (currentUrl.startsWith('/proyectos/')) {
      this.router.navigate(['/proyectos']);
    } else if (currentUrl.startsWith('/crm/persona/') || currentUrl.startsWith('/persona/')) {
      this.router.navigate(['/crm']);
    } else {
      this.router.navigate(['/home']);
    }
  }

  private handleRootExit(): void {
    const now = Date.now();
    if (now - this.lastBackPressTime < this.exitWindowMs) {
      this.exitApp();
    } else {
      this.lastBackPressTime = now;
      this.toastService.info('Presiona de nuevo para salir', {
        duration: this.exitWindowMs,
      });
    }
  }

  // Aislado en un método para poder espiarlo en tests: vi.mock('@capacitor/app')
  // no es fiable con el bundling del builder de unit-test de Angular.
  protected exitApp(): Promise<void> {
    return App.exitApp();
  }

  private isRootRoute(url: string): boolean {
    const clean = this.cleanUrl(url);
    return clean === '/home' || clean === '/login' || clean === '/servidor' || clean === '/' || clean === '';
  }

  private getCurrentCleanUrl(): string {
    return this.cleanUrl(this.router.url);
  }

  private cleanUrl(url: string): string {
    if (!url) return '';
    return url.split('?')[0].split('#')[0];
  }
}
