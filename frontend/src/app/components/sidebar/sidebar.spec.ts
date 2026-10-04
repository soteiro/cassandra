import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Sidebar } from './sidebar';
import { AuthService } from '../../services/auth.service';
import { AppUpdateService, UpdateCheckResult } from '../../services/app-update.service';
import { ToastService } from '../../services/toast.service';

describe('Sidebar', () => {
  let component: Sidebar;
  let fixture: ComponentFixture<Sidebar>;
  let authService: { logout: ReturnType<typeof vi.fn> };
  let updates: {
    isNative: boolean;
    currentVersion: ReturnType<typeof signal<string | null>>;
    checking: ReturnType<typeof signal<boolean>>;
    loadCurrentVersion: ReturnType<typeof vi.fn>;
    checkForUpdate: ReturnType<typeof vi.fn>;
    openDownload: ReturnType<typeof vi.fn>;
  };
  let toast: ToastService;
  let router: Router;

  async function create(isNative: boolean) {
    authService = { logout: vi.fn().mockReturnValue(of({})) };
    updates = {
      isNative,
      currentVersion: signal<string | null>(isNative ? '0.2.1' : null),
      checking: signal(false),
      loadCurrentVersion: vi.fn().mockResolvedValue(undefined),
      checkForUpdate: vi.fn(),
      openDownload: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: AppUpdateService, useValue: updates },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    toast = TestBed.inject(ToastService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  }

  const updateButton = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      /actualizaciones|Buscando/.test(b.textContent ?? ''),
    );
  const checkForUpdates = () => (component as unknown as { checkForUpdates: () => Promise<void> }).checkForUpdates();

  describe('en la web', () => {
    beforeEach(() => create(false));

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should navigate to /login after a successful logout', () => {
      (component as unknown as { chau: () => void }).chau();
      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should navigate to /login even if logout fails', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      authService.logout.mockReturnValue(throwError(() => new Error('boom')));
      (component as unknown as { chau: () => void }).chau();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should not show the update button', () => {
      expect(updateButton()).toBeUndefined();
    });
  });

  describe('en la app Android', () => {
    beforeEach(() => create(true));

    it('should show the update button with the installed version', () => {
      expect(updates.loadCurrentVersion).toHaveBeenCalled();
      expect(updateButton()?.textContent).toContain('Buscar actualizaciones');
      expect(updateButton()?.textContent).toContain('v0.2.1');
    });

    it('should disable the button while checking', async () => {
      updates.checking.set(true);
      await fixture.whenStable();
      expect(updateButton()?.disabled).toBe(true);
      expect(updateButton()?.textContent).toContain('Buscando...');
    });

    it('should offer the download when there is a new version', async () => {
      const result: UpdateCheckResult = {
        status: 'available',
        current: '0.2.1',
        latest: 'v0.2.2',
        downloadUrl: 'https://example.test/cassandra.apk',
      };
      updates.checkForUpdate.mockResolvedValue(result);

      updateButton()?.click();
      await vi.waitFor(() => expect(toast.toasts().length).toBe(1));

      const [shown] = toast.toasts();
      expect(shown.title).toBe('Nueva versión v0.2.2 disponible');
      expect(shown.message).toContain('v0.2.1');
      expect(shown.duration).toBe(0);
      shown.action?.onClick();
      expect(updates.openDownload).toHaveBeenCalledWith('https://example.test/cassandra.apk');
    });

    it('should confirm when the app is up to date', async () => {
      updates.checkForUpdate.mockResolvedValue({ status: 'up-to-date', current: '0.2.1' });
      await checkForUpdates();
      expect(toast.toasts()[0]).toMatchObject({ type: 'success', message: 'Tienes la última versión (v0.2.1).' });
    });

    it('should show an error toast if the check fails', async () => {
      updates.checkForUpdate.mockResolvedValue({ status: 'error' });
      await checkForUpdates();
      expect(toast.toasts()[0].type).toBe('error');
    });
  });
});
