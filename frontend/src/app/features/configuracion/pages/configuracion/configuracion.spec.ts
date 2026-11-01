import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from '../../../../app.routes';
import { APIKeyService } from '../../data/api-key.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { proyectService } from '../../../../services/proyect.service';
import { APPEARANCE_STORAGE_KEY } from '../../../../shared/models/appearance.model';
import { MainLayout } from '../../../../core/layout/main-layout/main-layout';
import { Login } from '../../../auth/pages/login/login';
import { ApiKeysPage } from '../api-keys-page/api-keys-page';
import { Configuracion } from './configuracion';

describe('Configuración routing', () => {
  const loggedIn = signal(true);
  const listKeys = vi.fn();

  beforeEach(async () => {
    localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    loggedIn.set(true);
    listKeys.mockReset().mockReturnValue(of([]));
    await TestBed.configureTestingModule({
      // Precarga los componentes del recorrido para que transformar los imports
      // lazy no consuma el tiempo de la primera prueba. Las rutas siguen siendo las reales.
      imports: [MainLayout, Login, ApiKeysPage, Configuracion],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isLoggedIn: loggedIn } },
        { provide: APIKeyService, useValue: { list: listKeys } },
        { provide: proyectService, useValue: {
          proyectResource: { value: signal([]), isLoading: signal(false), error: signal(undefined) },
        } },
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.removeItem(APPEARANCE_STORAGE_KEY));

  // La primera visita carga los componentes lazy del layout y de Configuración.
  it('opens appearance settings with a link to API keys and active navigation', async () => {
    const harness = await RouterTestingHarness.create('/configuracion');
    const page = harness.routeNativeElement!;

    expect(page.querySelector('h1')?.textContent).toBe('Configuración');
    expect(page.querySelector('#appearance-title')?.textContent).toBe('Apariencia');
    expect(page.querySelector('#appearance-palette')).not.toBeNull();
    expect(page.querySelector('a[href="/configuracion/claves-api"]')).not.toBeNull();
    expect(page.querySelector('app-api-keys')).toBeNull();
    expect(page.querySelector('a[href="/configuracion"]')?.getAttribute('aria-current')).toBe('page');
    expect(page.querySelector('a[href="/claves-api"]')).toBeNull();
    expect(listKeys).not.toHaveBeenCalled();
  }, 30_000);

  it('shows the saved selections when the options are first rendered', async () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ palette: 'violet', mode: 'light' }));
    const harness = await RouterTestingHarness.create('/configuracion');
    const page = harness.routeNativeElement!;

    expect(page.querySelector<HTMLSelectElement>('#appearance-palette')?.value).toBe('violet');
    expect(page.querySelector<HTMLSelectElement>('#appearance-mode')?.value).toBe('light');
  });

  it('changes the appearance through the selectors and opens keys through their link', async () => {
    const harness = await RouterTestingHarness.create('/configuracion');
    const page = harness.routeNativeElement!;
    const palette = page.querySelector<HTMLSelectElement>('#appearance-palette')!;
    palette.value = 'forest';
    palette.dispatchEvent(new Event('change'));
    const mode = page.querySelector<HTMLSelectElement>('#appearance-mode')!;
    mode.value = 'light';
    mode.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();

    expect(document.documentElement.dataset['palette']).toBe('forest');
    expect(document.documentElement.dataset['mode']).toBe('light');
    expect(listKeys).not.toHaveBeenCalled();
    page.querySelector<HTMLAnchorElement>('a[href="/configuracion/claves-api"]')!.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/configuracion/claves-api');
    expect(listKeys).toHaveBeenCalledOnce();
  }, 30_000);

  it('redirects the previous URL to the separate API key page', async () => {
    const harness = await RouterTestingHarness.create('/claves-api');

    expect(TestBed.inject(Router).url).toBe('/configuracion/claves-api');
    expect(harness.routeNativeElement?.querySelector('app-api-keys')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Claves API');
    expect(harness.routeNativeElement?.querySelector('a[href="/configuracion"]')).not.toBeNull();
    expect(listKeys).toHaveBeenCalledOnce();
  }, 30_000);

  it.each(['/configuracion', '/configuracion/claves-api', '/configuracion/ticktick', '/claves-api'])('requires a session before opening %s', async url => {
    loggedIn.set(false);
    await RouterTestingHarness.create(url);

    expect(TestBed.inject(Router).url).toBe('/login');
    expect(listKeys).not.toHaveBeenCalled();
  });
});
