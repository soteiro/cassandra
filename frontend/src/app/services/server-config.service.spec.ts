import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { APP_PLATFORM } from './app-platform';
import { normalizeServerUrl, SERVER_STORAGE_KEY, ServerConfigService } from './server-config.service';
import { proyectService } from './proyect.service';
import { AuthService } from './auth.service';

describe('normalizeServerUrl', () => {
  it.each([
    ['cassandra.midominio.com', 'https://cassandra.midominio.com'],
    ['  https://cassandra.midominio.com/  ', 'https://cassandra.midominio.com'],
    ['https://cassandra.midominio.com/api', 'https://cassandra.midominio.com'],
    ['https://cassandra.midominio.com/api/', 'https://cassandra.midominio.com'],
    ['https://midominio.com/cassandra/api', 'https://midominio.com/cassandra'],
    ['https://cassandra.local:8443', 'https://cassandra.local:8443'],
    ['http://192.168.1.10:8080', 'http://192.168.1.10:8080'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeServerUrl(input)).toBe(expected);
  });

  it.each(['', '   ', 'ftp://servidor.com', 'https://', 'no es una url'])('should reject %j', (input) => {
    expect(normalizeServerUrl(input)).toBeNull();
  });
});

describe('ServerConfigService', () => {
  let http: HttpTestingController;

  function setup(native: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_PLATFORM, useValue: { isNative: () => native, getVersion: async () => '0.3.0' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(ServerConfigService);
  }

  async function versionRequest(url: string): Promise<TestRequest> {
    let req!: TestRequest;
    await vi.waitFor(() => {
      req = http.expectOne(url);
    });
    return req;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('should use the environment API on the web', () => {
    const service = setup(false);
    expect(service.isConfigured()).toBe(true);
    expect(service.apiUrl()).toBe('/api');
  });

  it('should start unconfigured in the app when nothing is stored', () => {
    const service = setup(true);
    expect(service.isConfigured()).toBe(false);
    expect(service.apiUrl()).toBe('');
    expect(service.serverUrl()).toBeNull();
  });

  it('should restore the stored server in the app', () => {
    localStorage.setItem(SERVER_STORAGE_KEY, 'https://cassandra.midominio.com');
    const service = setup(true);
    expect(service.isConfigured()).toBe(true);
    expect(service.apiUrl()).toBe('https://cassandra.midominio.com/api');
  });

  it('connect should verify /api/version and store the server', async () => {
    const service = setup(true);
    const promise = service.connect('cassandra.midominio.com/api/');
    const req = await versionRequest('https://cassandra.midominio.com/api/version');
    expect(req.request.withCredentials).toBe(false);
    req.flush({ version: 'v0.3.0' });

    expect(await promise).toEqual({ ok: true, version: 'v0.3.0' });
    expect(service.apiUrl()).toBe('https://cassandra.midominio.com/api');
    expect(localStorage.getItem(SERVER_STORAGE_KEY)).toBe('https://cassandra.midominio.com');
  });

  it.each([
    ['dirección inválida', 'no es una url', 'Escribe una dirección válida'],
    ['http sin cifrar', 'http://cassandra.midominio.com', 'https://'],
  ])('connect should reject %s without requests', async (_, input, error) => {
    const service = setup(true);
    const result = await service.connect(input);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(error);
    expect(service.isConfigured()).toBe(false);
  });

  it('connect should reject a server that is not Cassandra', async () => {
    const service = setup(true);
    const promise = service.connect('https://otra-cosa.com');
    (await versionRequest('https://otra-cosa.com/api/version')).flush({ hola: 'mundo' });
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('no es un servidor Cassandra');
    expect(service.isConfigured()).toBe(false);
  });

  it('connect should report unreachable servers', async () => {
    const service = setup(true);
    const promise = service.connect('https://caido.com');
    (await versionRequest('https://caido.com/api/version')).flush(null, { status: 502, statusText: 'Bad Gateway' });
    const result = await promise;
    expect(!result.ok && result.error).toContain('No se pudo conectar');
  });

  it('disconnect should forget the server', () => {
    localStorage.setItem(SERVER_STORAGE_KEY, 'https://cassandra.midominio.com');
    const service = setup(true);
    service.disconnect();
    expect(service.isConfigured()).toBe(false);
    expect(localStorage.getItem(SERVER_STORAGE_KEY)).toBeNull();
  });

  describe('integración con los servicios de la API (app)', () => {
    it('should send requests to the configured server', () => {
      localStorage.setItem(SERVER_STORAGE_KEY, 'https://cassandra.midominio.com');
      setup(true);
      TestBed.inject(proyectService).deleteProyect(3).subscribe();
      http.expectOne('https://cassandra.midominio.com/api/proyects/3').flush(null);
    });

    it('AuthService.me should not call any server while unconfigured', () => {
      setup(true);
      let result: boolean | undefined;
      TestBed.inject(AuthService).me().subscribe((v) => (result = v));
      expect(result).toBe(false);
      http.expectNone(() => true);
    });
  });
});
