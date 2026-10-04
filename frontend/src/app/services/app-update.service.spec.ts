import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { APK_ASSET_NAME, APP_PLATFORM, AppPlatform, AppUpdateService } from './app-update.service';
import { environment } from '../../environments/environment';

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

  function setup(native = true, version = '0.2.1', extraProviders: unknown[] = []) {
    platform = {
      isNative: vi.fn().mockReturnValue(native),
      getVersion: vi.fn().mockResolvedValue(version),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_PLATFORM, useValue: platform as AppPlatform },
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

  afterEach(() => http.verify());

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

  it('openDownload should navigate to the url', () => {
    // jsdom no permite espiar location.assign: se usa un DOCUMENT falso.
    const assign = vi.fn();
    const service = setup(true, '0.2.1', [{ provide: DOCUMENT, useValue: { location: { assign } } }]);
    service.openDownload(APK_URL);
    expect(assign).toHaveBeenCalledWith(APK_URL);
  });
});
