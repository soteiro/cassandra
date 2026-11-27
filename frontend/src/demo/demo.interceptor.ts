import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, from, mergeMap, of, throwError } from 'rxjs';
import type { MockResponse } from './mock/api';

const PREFIJO = '/api';
/** Latencia simulada: lo justo para que los estados de carga se vean naturales. */
const LATENCIA_MS = 120;

/** La API simulada (con sus datos de ejemplo) se carga aparte, fuera del bundle inicial. */
let api: Promise<typeof import('./mock/api')> | null = null;
const cargarApi = () => (api ??= import('./mock/api'));

/** Responde /api/* desde la base de la demo; lo demás (GitHub, assets) pasa al servidor real. */
export const demoInterceptor: HttpInterceptorFn = (req, next) => {
  const url = new URL(req.urlWithParams, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith(`${PREFIJO}/`)) {
    return next(req);
  }

  return from(cargarApi()).pipe(
    delay(LATENCIA_MS),
    mergeMap(({ manejar }) => {
      let res: MockResponse;
      try {
        res = manejar({
          method: req.method,
          path: url.pathname.slice(PREFIJO.length),
          query: url.searchParams,
          body: req.body,
        });
      } catch (err) {
        console.error('[demo] error en la API simulada', err);
        res = { status: 500, body: 'Error en la API simulada' };
      }
      if (res.status >= 400) {
        return throwError(
          () => new HttpErrorResponse({ status: res.status, error: res.body, url: req.url }),
        );
      }
      // Copia: así la UI no muta la base por referencia.
      const body = res.body === null ? null : structuredClone(res.body);
      return of(new HttpResponse({ status: res.status, body, url: req.url }));
    }),
  );
};
