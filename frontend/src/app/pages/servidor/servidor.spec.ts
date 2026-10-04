import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Servidor } from './servidor';
import { ConnectResult, ServerConfigService } from '../../services/server-config.service';
import { ToastService } from '../../services/toast.service';

describe('Servidor', () => {
  let fixture: ComponentFixture<Servidor>;
  let serverConfig: { serverUrl: ReturnType<typeof signal<string | null>>; connect: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    serverConfig = { serverUrl: signal<string | null>(null), connect: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [Servidor],
      providers: [provideRouter([]), { provide: ServerConfigService, useValue: serverConfig }],
    }).compileComponents();
    fixture = TestBed.createComponent(Servidor);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const input = () => el().querySelector<HTMLInputElement>('#server-address')!;
  const submit = () => el().querySelector<HTMLButtonElement>('button[type="submit"]')!;

  async function type(value: string) {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('should have an accessible, labelled address field and disable submit while empty', () => {
    expect(el().querySelector('label[for="server-address"]')?.textContent).toContain('Dirección del servidor');
    expect(submit().disabled).toBe(true);
  });

  it('should connect and go to /login', async () => {
    serverConfig.connect.mockImplementation(async (): Promise<ConnectResult> => {
      serverConfig.serverUrl.set('https://cassandra.midominio.com');
      return { ok: true, version: 'v0.3.0' };
    });
    await type('cassandra.midominio.com');
    submit().click();

    await vi.waitFor(() => expect(router.navigate).toHaveBeenCalledWith(['/login']));
    expect(serverConfig.connect).toHaveBeenCalledWith('cassandra.midominio.com');
    expect(TestBed.inject(ToastService).toasts()[0].message).toContain('https://cassandra.midominio.com');
  });

  it('should show the error and stay on the page', async () => {
    serverConfig.connect.mockResolvedValue({ ok: false, error: 'El servidor debe usar https://' });
    await type('http://inseguro.com');
    submit().click();

    await vi.waitFor(() => expect(el().querySelector('[role="alert"]')?.textContent).toContain('https://'));
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
