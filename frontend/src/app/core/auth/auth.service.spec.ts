import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should start logged out', () => {
    expect(service.isLoggedIn()).toBe(false);
  });

  it('login should POST credentials and mark the session as logged in', () => {
    const credentials = { email: 'a@b.cl', password: 'secret' } as never;
    service.login(credentials).subscribe();

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(credentials);
    req.flush({});

    expect(service.isLoggedIn()).toBe(true);
  });

  it('login should keep the session logged out when it fails', () => {
    service.login({} as never).subscribe({ error: () => {} });
    http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(service.isLoggedIn()).toBe(false);
  });

  it('logout should POST and mark the session as logged out', () => {
    service.isLoggedIn.set(true);
    service.logout().subscribe();

    const req = http.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush({});

    expect(service.isLoggedIn()).toBe(false);
  });

  it('me should emit true and log in when the session is valid', () => {
    let result: boolean | undefined;
    service.me().subscribe((v) => (result = v));

    http.expectOne('/api/auth/me').flush({ id: 1 });

    expect(result).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
  });

  it('me should emit false without erroring when the session is invalid', () => {
    let result: boolean | undefined;
    const error = vi.fn();
    service.me().subscribe({ next: (v) => (result = v), error });

    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(result).toBe(false);
    expect(error).not.toHaveBeenCalled();
    expect(service.isLoggedIn()).toBe(false);
  });

  it('refresh should POST to /auth/refresh', () => {
    service.refresh().subscribe();
    const req = http.expectOne('/api/auth/refresh');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
