import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  it('should send every request with credentials', () => {
    http.get('/api/proyects').subscribe();
    const req = backend.expectOne('/api/proyects');
    expect(req.request.withCredentials).toBe(true);
    req.flush([]);
  });

  it('should propagate non-401 errors without refreshing', () => {
    const error = vi.fn();
    http.get('/api/proyects').subscribe({ error });

    backend.expectOne('/api/proyects').flush(null, { status: 500, statusText: 'Server Error' });

    backend.expectNone('/api/auth/refresh');
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
  });

  it.each(['/api/auth/login', '/api/auth/me', '/api/auth/logout', '/api/auth/refresh'])(
    'should not try to refresh on a 401 from %s',
    (url) => {
      const error = vi.fn();
      http.post(url, {}).subscribe({ error });

      backend.expectOne(url).flush(null, UNAUTHORIZED);

      backend.expectNone('/api/auth/refresh');
      expect(error).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
    },
  );

  it('should refresh the session and retry the request on a 401', () => {
    const next = vi.fn();
    http.get('/api/tareas').subscribe(next);

    backend.expectOne('/api/tareas').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/auth/refresh').flush({});
    backend.expectOne('/api/tareas').flush([{ id: 1 }]);

    expect(next).toHaveBeenCalledWith([{ id: 1 }]);
  });

  it('should refresh only once when several requests fail concurrently', () => {
    const a = vi.fn();
    const b = vi.fn();
    http.get('/api/a').subscribe(a);
    http.get('/api/b').subscribe(b);

    backend.expectOne('/api/a').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/b').flush(null, UNAUTHORIZED);

    const refreshes = backend.match('/api/auth/refresh');
    expect(refreshes.length).toBe(1);
    refreshes[0].flush({});

    backend.expectOne('/api/a').flush('A');
    backend.expectOne('/api/b').flush('B');

    expect(a).toHaveBeenCalledWith('A');
    expect(b).toHaveBeenCalledWith('B');
  });

  it('should log out and go to /login when the refresh fails', () => {
    authService.isLoggedIn.set(true);
    const error = vi.fn();
    http.get('/api/tareas').subscribe({ error });

    backend.expectOne('/api/tareas').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/auth/refresh').flush(null, UNAUTHORIZED);

    expect(authService.isLoggedIn()).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));

    backend.expectOne('/api/auth/logout').flush({});
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should be able to refresh again after a failed refresh', () => {
    http.get('/api/x').subscribe({ error: () => {} });
    backend.expectOne('/api/x').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/auth/refresh').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/auth/logout').flush({});

    const next = vi.fn();
    http.get('/api/y').subscribe(next);
    backend.expectOne('/api/y').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/auth/refresh').flush({});
    backend.expectOne('/api/y').flush('ok');

    expect(next).toHaveBeenCalledWith('ok');
  });
});
