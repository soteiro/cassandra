import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TickTickPage, TICKTICK_NAVIGATE } from './ticktick-page';

describe('TickTickPage', () => {
  const navigate = vi.fn();
  beforeEach(() => {
    navigate.mockReset();
    TestBed.configureTestingModule({
      imports: [TickTickPage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: TICKTICK_NAVIGATE, useValue: navigate },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup(connected = false) {
    const fixture = TestBed.createComponent(TickTickPage);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/connections/ticktick').flush({ available: true, connected, needs_reauthorize: false, connected_at: null });
    fixture.detectChanges();
    return { fixture, http, el: fixture.nativeElement as HTMLElement };
  }
  it('requests authorization without credentials and navigates only to TickTick', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.connect();
    const request = http.expectOne('/api/connections/ticktick/authorize');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ authorization_url: 'https://ticktick.com/oauth/authorize?scope=tasks%3Aread' });
    expect(navigate).toHaveBeenCalledOnce();
  });
  it('rejects an unexpected redirect origin', () => {
    const { fixture, http } = setup();
    fixture.componentInstance.connect();
    http.expectOne('/api/connections/ticktick/authorize').flush({ authorization_url: 'https://evil.test' });
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('No se pudo abrir');
    expect(fixture.componentInstance.saving()).toBe(false);
  });
  it('requires confirmation before disconnecting and reports failed remote revocation', () => {
    const { fixture, http, el } = setup(true);
    el.querySelector<HTMLButtonElement>('button')!.click(); fixture.detectChanges();
    http.expectNone((r) => r.method === 'DELETE');
    expect(el.textContent).toContain('¿Desconectar tu cuenta?');
    fixture.componentInstance.disconnect();
    const request = http.expectOne('/api/connections/ticktick');
    expect(request.request.method).toBe('DELETE');
    request.flush({ available: true, connected: false, needs_reauthorize: false, connected_at: null, revocation_failed: true });
    fixture.detectChanges();
    expect(el.textContent).toContain('No se pudo confirmar la revocación');
    expect(el.textContent).toContain('Conectar TickTick');
  });
  it('removes callback status from the address and explains expiry', () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { queryParamMap: convertToParamMap({ ticktick: 'invalid_state' }) } } });
    const router = TestBed.inject(Router);
    const clean = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const { el } = setup();
    expect(el.textContent).toContain('venció o ya se utilizó');
    expect(clean).toHaveBeenCalledWith([], expect.objectContaining({ replaceUrl: true, queryParams: { ticktick: null } }));
  });
});
