import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { serverConfiguredGuard } from './server-configured.guard';
import { ServerConfigService } from '../services/server-config.service';

describe('serverConfiguredGuard', () => {
  function run(configured: boolean) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ServerConfigService, useValue: { isConfigured: () => configured } }],
    });
    return TestBed.runInInjectionContext(() =>
      serverConfiguredGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('should allow navigation when a server is configured', () => {
    expect(run(true)).toBe(true);
  });

  it('should redirect to /servidor otherwise', () => {
    const result = run(false);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/servidor');
  });
});
