import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { APK_ASSET_NAME, APP_PLATFORM, AppPlatform, AppUpdateService } from './app-update.service';
import { environment } from '../../environments/environment';
import { APK_UPDATER, ApkDownloadStatus, ApkUpdaterPlugin } from './apk-updater';
import { ToastService } from './toast.service';

const APK_URL = 'https://github.com/soteiro/cassandra/releases/download/v0.2.2/cassandra.apk';
const RELEASE_PAGE = 'https://github.com/soteiro/cassandra/releases/tag/v0.2.2';

function release(tag: string, withApk = true) {
  return {
    tag_name: tag,
    html_url: RELEASE_PAGE,
    assets: withApk ? [{ name: APK_ASSET_NAME, browser_download_url: APK_URL }] : [],
  };
}

describe('AppUpdateService', () => {
  let platform: { isNative: ReturnType<typeof vi.fn>; getVersion: ReturnType<typeof vi.fn> };
  let http: HttpTestingController;
  let updater: { [K in keyof ApkUpdaterPlugin]: ReturnType<typeof vi.fn> };

  function setup(native = true, version = '0.2.1', extraProviders: unknown[] = [], initialDownload: ApkDownloadStatus = { status: 'idle' }) {
    platform = {
      isNative: vi.fn().mockReturnValue(native),
      getVersion: vi.fn().mockResolvedValue(version),
    };
    updater = {
      startDownload: vi.fn().mockResolvedValue({ status: 'downloading' }),
      getDownloadStatus: vi.fn().mockResolvedValue(initialDownload),
      install: vi.fn().mockResolvedValue({ permissionRequired: false }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_PLATFORM, useValue: platform as AppPlatform },
        { provide: APK_UPDATER, useValue: updater },
        ...(extraProviders as never[]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AppUpdateService);
  }

  /** Espera la petición a GitHub (se emite tras leer la versión instalada). */
  async function githubRequest(): Promise<TestRequest> {
    let req!: TestRequest;
    await vi.waitFor(() => {
      req = http.expectOne(environment.releasesApiUrl);
    });
    return req;
  }

  /** Lanza la comprobación y responde la petición a la API de GitHub. */
  async function check(service: AppUpdateService, body: object | null, status = 200) {
    const promise = service.checkForUpdate();
    const req = await githubRequest();
    if (status === 200) req.flush(body);
    else req.flush(null, { status, statusText: 'Error' });
    return promise;
  }

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('should expose the installed version on native platforms', async () => {
    const service = setup();
    await service.loadCurrentVersion();
    expect(service.isNative).toBe(true);
    expect(service.currentVersion()).toBe('0.2.1');
  });

  it('should not read the version on the web', async () => {
    const service = setup(false);
    await service.loadCurrentVersion();
    expect(service.isNative).toBe(false);
    expect(platform.getVersion).not.toHaveBeenCalled();
  });

  it('should report an available update with the APK url', async () => {
    const service = setup();
    const result = await check(service, release('v0.2.2'));
    expect(result).toEqual({ status: 'available', current: '0.2.1', latest: 'v0.2.2', downloadUrl: APK_URL });
    expect(service.checking()).toBe(false);
  });

  it('should fall back to the release page when the APK is not attached yet', async () => {
    const service = setup();
    const result = await check(service, release('v0.2.2', false));
    expect(result).toMatchObject({ status: 'available', downloadUrl: RELEASE_PAGE });
  });

  it.each(['v0.2.1', 'v0.2.0'])('should be up to date when the latest release is %s', async (tag) => {
    const service = setup();
    expect(await check(service, release(tag))).toEqual({ status: 'up-to-date', current: '0.2.1' });
  });

  it('should report an error if GitHub fails', async () => {
    const service = setup();
    expect(await check(service, null, 503)).toEqual({ status: 'error' });
    expect(service.checking()).toBe(false);
  });

  it('should not send cookies to GitHub (bypasses the auth interceptor)', async () => {
    const service = setup();
    const promise = service.checkForUpdate();
    const req = await githubRequest();
    expect(req.request.withCredentials).toBe(false);
    req.flush(release('v0.2.1'));
    await promise;
  });

  it('openDownload should navigate to the url on the web', () => {
    // jsdom no permite espiar location.assign: se usa un DOCUMENT falso.
    const assign = vi.fn();
    const service = setup(false, '0.2.1', [{ provide: DOCUMENT, useValue: { location: { assign } } }]);
    service.openDownload(APK_URL);
    expect(assign).toHaveBeenCalledWith(APK_URL);
  });

  it('should download natively, track progress and offer installation only when ready', async () => {
    vi.useFakeTimers();
    const assign = vi.fn();
    const service = setup(true, '0.2.1', [{ provide: DOCUMENT, useValue: { location: { assign } } }]);
    await Promise.resolve();
    updater.getDownloadStatus.mockResolvedValueOnce({ status: 'downloading', progress: 42 })
      .mockResolvedValueOnce({ status: 'ready' });
    service.openDownload(APK_URL);
    service.openDownload(APK_URL);
    await Promise.resolve();
    expect(updater.startDownload).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    await service.installUpdate();
    expect(updater.install).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(service.download()).toEqual({ status: 'downloading', progress: 42 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(service.download().status).toBe('ready');
    expect(service.downloading()).toBe(false);
    const toast = TestBed.inject(ToastService).toasts().find(t => t.action?.label === 'Instalar actualización');
    expect(toast).toBeDefined();
    await service.installUpdate();
    expect(updater.install).toHaveBeenCalledOnce();
  });

  it('should restore a download after restarting the app', async () => {
    vi.useFakeTimers();
    const service = setup(true, '0.2.1', [], { status: 'paused', progress: 20 });
    await Promise.resolve();
    expect(service.download().status).toBe('paused');
    expect(updater.startDownload).not.toHaveBeenCalled();
    updater.getDownloadStatus.mockResolvedValueOnce({ status: 'ready' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(service.download().status).toBe('ready');
  });

  it('should report download failure and allow retry', async () => {
    const service = setup();
    await Promise.resolve();
    updater.startDownload.mockRejectedValueOnce(new Error('offline'));
    service.openDownload(APK_URL);
    await Promise.resolve();
    expect(service.download().status).toBe('failed');
    expect(service.downloading()).toBe(false);
    service.openDownload(APK_URL);
    await Promise.resolve();
    expect(updater.startDownload).toHaveBeenCalledTimes(2);
    expect(service.download().status).toBe('downloading');
  });

  it('should explain the install permission and keep the APK ready for retry', async () => {
    const service = setup();
    await Promise.resolve();
    updater.startDownload.mockResolvedValueOnce({ status: 'ready' });
    updater.install.mockResolvedValueOnce({ permissionRequired: true });
    service.openDownload(APK_URL);
    await Promise.resolve();
    await service.installUpdate();
    expect(service.download().status).toBe('ready');
    expect(TestBed.inject(ToastService).toasts().some(t => t.message.includes('Permitir desde esta fuente'))).toBe(true);
    await service.installUpdate();
    expect(updater.install).toHaveBeenCalledTimes(2);
  });

  it('should keep the browser fallback for a release without an APK', () => {
    const assign = vi.fn();
    const service = setup(true, '0.2.1', [{ provide: DOCUMENT, useValue: { location: { assign } } }]);
    service.openDownload(RELEASE_PAGE);
    expect(assign).toHaveBeenCalledWith(RELEASE_PAGE);
    expect(updater.startDownload).not.toHaveBeenCalled();
  });
});
