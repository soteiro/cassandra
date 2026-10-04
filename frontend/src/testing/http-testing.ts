import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable } from 'rxjs';
import { AuthService } from '../app/services/auth.service';

/** Configura TestBed con HttpClient de prueba y devuelve el controlador. */
export function setupHttpTesting(options: { loggedIn?: boolean } = {}): HttpTestingController {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  TestBed.inject(AuthService).isLoggedIn.set(options.loggedIn ?? true);
  return TestBed.inject(HttpTestingController);
}

export interface HttpCase {
  name: string;
  call: () => Observable<unknown>;
  method: string;
  url: string;
  body?: unknown;
}

/** Ejecuta la llamada y verifica método, URL y body de la petición emitida. */
export function expectHttpCall(http: HttpTestingController, c: HttpCase): void {
  const next = vi.fn();
  c.call().subscribe(next);
  const req = http.expectOne((r) => r.urlWithParams === c.url);
  expect(req.request.method).toBe(c.method);
  if (c.body !== undefined) {
    expect(req.request.body).toEqual(c.body);
  }
  req.flush({ ok: true });
  expect(next).toHaveBeenCalledWith({ ok: true });
}

/** Espera a que los httpResource procesen las respuestas ya enviadas con flush(). */
export function settle(): Promise<void> {
  return TestBed.inject(ApplicationRef).whenStable();
}
