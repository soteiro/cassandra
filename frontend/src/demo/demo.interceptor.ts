import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { asapScheduler, from, map, of, type Observable } from 'rxjs';
import type { MockResponse } from './mock/api';

const PREFIJO = '/api';

/**
 * La API simulada (con sus datos de ejemplo) va en un chunk aparte para no agrandar el
 * bundle inicial. Se empieza a descargar al arrancar (ver providers.demo.ts), en paralelo
 * con las rutas, así cuando la primera pantalla pide datos ya está lista.
 */
let api: Promise<typeof import('./mock/api')> | null = null;
export const cargarApi = () => (api ??= import('./mock/api'));

/**
 * Respuestas que no dependen de los datos. /api/auth/me bloquea el arranque
 * (APP_INITIALIZER): contestarla sin esperar al mock evita sumarle una descarga.
 */
const FIJAS: Record<string, unknown> = {
  'GET /auth/me': { user_id: 1 },
  'GET /version': { version: 'demo' },
};

/** Responde /api/* desde la base de la demo; lo demás (GitHub, assets) pasa al servidor real. */
export const demoInterceptor: HttpInterceptorFn = (req, next) => {
  const url = new URL(req.urlWithParams, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith(`${PREFIJO}/`)) {
    return next(req);
  }
  const path = url.pathname.slice(PREFIJO.length);

  const fija = FIJAS[`${req.method} ${path}`];
  if (fija) {
    return responder(of({ status: 200, body: fija }, asapScheduler), req.url);
  }

  const res$ = from(cargarApi()).pipe(
    map(({ manejar }) => {
      try {
        return manejar({ method: req.method, path, query: url.searchParams, body: req.body });
      } catch (err) {
        console.error('[demo] error en la API simulada', err);
        return { status: 500, body: 'Error en la API simulada' };
      }
    }),
  );
  return responder(res$, req.url);
};

function responder(res$: Observable<MockResponse>, url: string) {
  return res$.pipe(
    map((res) => {
      if (res.status >= 400) {
        throw new HttpErrorResponse({ status: res.status, error: res.body, url });
      }
      // Copia: así la UI no muta la base por referencia.
      const body = res.body === null ? null : structuredClone(res.body);
      return new HttpResponse({ status: res.status, body, url });
    }),
  );
}
