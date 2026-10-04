import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEnvironmentInjector, EnvironmentInjector, runInInjectionContext, NgZone } from '@angular/core';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';
import { BackButtonService } from './back-button.service';
import { ToastService } from './toast.service';

describe('BackButtonService', () => {
  let service: BackButtonService;
  let routerEvents$: Subject<any>;
  let mockRouter: any;
  let mockLocation: any;
  let mockToastService: any;
  let mockNgZone: any;
  let exitApp: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    routerEvents$ = new Subject();

    mockRouter = {
      url: '/home',
      events: routerEvents$.asObservable(),
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockLocation = {
      back: vi.fn(),
    };

    mockToastService = {
      info: vi.fn(),
    };

    mockNgZone = {
      run: (fn: Function) => fn(),
    };

    const injector = createEnvironmentInjector([
      { provide: Router, useValue: mockRouter },
      { provide: Location, useValue: mockLocation },
      { provide: ToastService, useValue: mockToastService },
      { provide: NgZone, useValue: mockNgZone },
    ], {} as EnvironmentInjector);

    service = runInInjectionContext(injector, () => new BackButtonService());
    exitApp = vi.spyOn(service as any, 'exitApp').mockResolvedValue(undefined);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Handler Registration & Priority', () => {
    it('should execute highest priority handler first', async () => {
      const log: string[] = [];

      service.register(50, () => {
        log.push('priority-50');
      });

      service.register(100, () => {
        log.push('priority-100');
      });

      service.register(80, () => {
        log.push('priority-80');
      });

      await service.handleBackButton();

      expect(log).toEqual(['priority-100']);
    });

    it('should execute latest handler when priorities are equal (LIFO)', async () => {
      const log: string[] = [];

      service.register(80, () => {
        log.push('modal-1');
      });

      service.register(80, () => {
        log.push('modal-2');
      });

      await service.handleBackButton();

      expect(log).toEqual(['modal-2']);
    });

    it('should unregister handler correctly', async () => {
      const log: string[] = [];

      const unregisterModal = service.register(100, () => {
        log.push('modal');
      });

      service.register(50, () => {
        log.push('sidebar');
      });

      unregisterModal();

      await service.handleBackButton();

      expect(log).toEqual(['sidebar']);
    });

    it('should continue to next handler if a handler returns false', async () => {
      const log: string[] = [];

      service.register(100, () => {
        log.push('handler-100');
        return false;
      });

      service.register(80, () => {
        log.push('handler-80');
      });

      await service.handleBackButton();

      expect(log).toEqual(['handler-100', 'handler-80']);
    });
  });

  describe('Navigation & Exit Behavior', () => {
    it('should prompt to exit when on root route /home', async () => {
      mockRouter.url = '/home';

      await service.handleBackButton();

      expect(mockToastService.info).toHaveBeenCalledWith('Presiona de nuevo para salir', {
        duration: 2000,
      });
      expect(exitApp).not.toHaveBeenCalled();
    });

    it('should exit app when pressed twice within exit window on root route', async () => {
      mockRouter.url = '/home';

      await service.handleBackButton();
      expect(mockToastService.info).toHaveBeenCalledTimes(1);

      await service.handleBackButton();
      expect(exitApp).toHaveBeenCalledTimes(1);
    });

    it('should prompt to exit on /login route', async () => {
      mockRouter.url = '/login';

      await service.handleBackButton();

      expect(mockToastService.info).toHaveBeenCalledWith('Presiona de nuevo para salir', {
        duration: 2000,
      });
    });

    it('should call location.back() when history stack has prior entries', async () => {
      // Simulate navigation: /home -> /proyectos -> /proyectos/5
      routerEvents$.next(new NavigationEnd(1, '/home', '/home'));
      routerEvents$.next(new NavigationEnd(2, '/proyectos', '/proyectos'));
      routerEvents$.next(new NavigationEnd(3, '/proyectos/5', '/proyectos/5'));

      mockRouter.url = '/proyectos/5';

      await service.handleBackButton();

      expect(mockLocation.back).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should use fallback navigation to parent when history is empty', async () => {
      mockRouter.url = '/proyectos/123';

      await service.handleBackButton();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/proyectos']);
    });

    it('should fallback to /crm when on /crm/persona/:id without history', async () => {
      mockRouter.url = '/crm/persona/456';

      await service.handleBackButton();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/crm']);
    });

    it('should fallback to /home when on a top-level section without history', async () => {
      mockRouter.url = '/finanzas';

      await service.handleBackButton();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/home']);
    });
  });
});
