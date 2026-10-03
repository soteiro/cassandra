import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ReflexionService } from './reflexion.service';
import { AuthService } from './auth.service';
import { expectHttpCall, HttpCase, settle, setupHttpTesting } from '../../testing/http-testing';

describe('ReflexionService', () => {
  let http: HttpTestingController;
  let service: ReflexionService;

  beforeEach(async () => {
    http = setupHttpTesting();
    service = TestBed.inject(ReflexionService);
    TestBed.tick();
    http.expectOne('/api/reflexiones').flush([]);
    await settle();
  });

  afterEach(() => http.verify());

  it('reload should request the list again', () => {
    service.reload();
    TestBed.tick();
    http.expectOne('/api/reflexiones').flush([]);
  });

  it.each([
    [null, '/api/reflexiones'],
    ['todas', '/api/reflexiones'],
    ['diario', '/api/reflexiones?tipo=diario'],
  ])('getReflexionesByTipo with %s should request %s', (tipo, url) => {
    TestBed.runInInjectionContext(() => service.getReflexionesByTipo(() => tipo));
    TestBed.tick();
    http.expectOne(url).flush([]);
  });

  it('getReflexionById should request by id and skip without id', () => {
    TestBed.runInInjectionContext(() => service.getReflexionById(() => 3));
    TestBed.runInInjectionContext(() => service.getReflexionById(() => null));
    TestBed.tick();
    http.expectOne('/api/reflexiones/3').flush({});
  });

  it('should return undefined resources when logged out', () => {
    TestBed.inject(AuthService).isLoggedIn.set(false);
    TestBed.runInInjectionContext(() => {
      expect(service.getReflexionesByTipo(() => null)).toBeUndefined();
      expect(service.getReflexionById(() => 1)).toBeUndefined();
    });
  });

  it.each<HttpCase>([
    { name: 'createReflexion', call: () => service.createReflexion({ contenido: 'x' } as never), method: 'POST', url: '/api/reflexiones', body: { contenido: 'x' } },
    { name: 'updateReflexion', call: () => service.updateReflexion(3, { contenido: 'y' } as never), method: 'PUT', url: '/api/reflexiones/3', body: { contenido: 'y' } },
    { name: 'deleteReflexion', call: () => service.deleteReflexion(3), method: 'DELETE', url: '/api/reflexiones/3' },
  ])('$name should call $method $url', (c) => expectHttpCall(http, c));
});
