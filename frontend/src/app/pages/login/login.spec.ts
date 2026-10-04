import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Login } from './login';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { signal } from '@angular/core';
import { ServerConfigService } from '../../services/server-config.service';

type LoginInternals = {
  email: { (): string; set: (v: string) => void };
  password: { (): string; set: (v: string) => void };
  showPassword: () => boolean;
  errorMessage: () => string | null;
  onSubmit: (e: Event) => void;
};

describe('Login', () => {
  let component: LoginInternals;
  let fixture: ComponentFixture<Login>;
  let authService: { login: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    authService = { login: vi.fn().mockReturnValue(of({})) };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance as unknown as LoginInternals;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.email()).toBe('');
    expect(component.password()).toBe('');
  });

  it('sends the credentials, shows a toast and navigates to /home on success', () => {
    component.email.set('yo@test.cl');
    component.password.set('secreto');
    const event = { preventDefault: vi.fn() } as unknown as Event;

    component.onSubmit(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(authService.login).toHaveBeenCalledWith({ email: 'yo@test.cl', password: 'secreto' });
    expect(toast.success).toHaveBeenCalledWith('Bienvenido a Cassandra');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(component.errorMessage()).toBeNull();
  });

  it('sets an error message and does not navigate on failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    authService.login.mockReturnValue(throwError(() => new Error('401')));

    component.onSubmit({ preventDefault: vi.fn() } as unknown as Event);

    expect(component.errorMessage()).toBe('credenciales invalidas');
    expect(toast.error).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('submits the values typed in the form', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const emailInput = el.querySelector('input[name="email"]') as HTMLInputElement;
    const passInput = el.querySelector('input[name="password"]') as HTMLInputElement;
    emailInput.value = 'a@b.cl';
    emailInput.dispatchEvent(new Event('input'));
    passInput.value = 'pw';
    passInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(authService.login).toHaveBeenCalledWith({ email: 'a@b.cl', password: 'pw' });
  });

  it('toggles password visibility', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const passInput = el.querySelector('input[name="password"]') as HTMLInputElement;
    expect(passInput.type).toBe('password');

    (el.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(component.showPassword()).toBe(true);
    expect(passInput.type).toBe('text');
  });
});

describe('Login en la app Android', () => {
  it('should show the connected server and allow changing it', async () => {
    const serverConfig = {
      isNative: true,
      serverUrl: signal<string | null>('https://cassandra.midominio.com'),
      disconnect: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login: vi.fn() } },
        { provide: ServerConfigService, useValue: serverConfig },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Login);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Conectado a https://cassandra.midominio.com');

    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cambiar')!.click();
    expect(serverConfig.disconnect).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/servidor']);
  });
});
