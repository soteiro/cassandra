import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  switchMap,
  throwError,
  filter,
  take,
  BehaviorSubject,
  Observable,
} from 'rxjs';
import { AuthService } from '../services/auth.service';

// single-flight: si varias peticiones dan 401 a la vez (ej: al reanudar PC),
// solo se llama a /api/auth/refresh una vez. El resto queda encolada esperando
// a que el refresh emita y luego reintenta con el nuevo access_token.
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

// URL que NO disparan refresh (evitan recursion y logica inutil).
const EXCLUDED_URLS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/me',
  '/api/auth/logout',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. withCredentials siempre: el navegador adjunta las cookies HttpOnly.
  const reqWithCreds = req.clone({ withCredentials: true });

  const isExcluded = EXCLUDED_URLS.some((url) => req.url.includes(url));

  return next(reqWithCreds).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isExcluded) {
        return handle401(reqWithCreds, next, authService, router);
      }
      return throwError(() => error);
    }),
  );
};

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
): Observable<any> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refresh().pipe(
      switchMap(() => {
        isRefreshing = false;
        refreshTokenSubject.next('done');
        return next(req);
      }),
      catchError((err) => {
        isRefreshing = false;
        // refresh falto: logout real. Limpia refresh_token en DB y cookies.
        authService.isLoggedIn.set(false);
        authService.logout().subscribe({
          error: () => {},
          complete: () => router.navigate(['/login']),
        });
        return throwError(() => err);
      }),
    );
  }

  // ya hay un refresh en curso: esperar a que termine y reintentar
  return refreshTokenSubject.pipe(
    filter((signal) => signal !== null),
    take(1),
    switchMap(() => next(req)),
  );
}