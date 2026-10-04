import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { InteraccionService } from './interaccion.service';
import { AuthService } from './auth.service';
import { expectHttpCall, HttpCase, setupHttpTesting } from '../../testing/http-testing';

describe('InteraccionService', () => {
  let http: HttpTestingController;
  let service: InteraccionService;

  beforeEach(() => {
    http = setupHttpTesting();
    service = TestBed.inject(InteraccionService);
  });

  afterEach(() => http.verify());

  it('getInteraccionesByPersonaId should request the persona interactions', () => {
    TestBed.runInInjectionContext(() => service.getInteraccionesByPersonaId(() => 6));
    TestBed.tick();
    http.expectOne('/api/personas/6/interacciones').flush([]);
  });

  it('getInteraccionesByPersonaId should not request without id and be undefined when logged out', () => {
    TestBed.runInInjectionContext(() => service.getInteraccionesByPersonaId(() => null));
    TestBed.tick();
    http.expectNone(() => true);

    TestBed.inject(AuthService).isLoggedIn.set(false);
    expect(TestBed.runInInjectionContext(() => service.getInteraccionesByPersonaId(() => 6))).toBeUndefined();
  });

  it.each<HttpCase>([
    { name: 'createInteraccion', call: () => service.createInteraccion(6, { interaccion: 'café' }), method: 'POST', url: '/api/personas/6/interacciones', body: { interaccion: 'café' } },
    { name: 'updateInteraccion', call: () => service.updateInteraccion(2, { interaccion: 'té' } as never), method: 'PUT', url: '/api/interacciones/2', body: { interaccion: 'té' } },
    { name: 'deleteInteraccion', call: () => service.deleteInteraccion(2), method: 'DELETE', url: '/api/interacciones/2' },
  ])('$name should call $method $url', (c) => expectHttpCall(http, c));
});
