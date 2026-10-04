import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { NotaService } from './nota.service';
import { AuthService } from './auth.service';
import { expectHttpCall, HttpCase, setupHttpTesting } from '../../testing/http-testing';

describe('NotaService', () => {
  let http: HttpTestingController;
  let service: NotaService;

  beforeEach(() => {
    http = setupHttpTesting();
    service = TestBed.inject(NotaService);
  });

  afterEach(() => http.verify());

  it('getNotasByProyectoId should request the project notes', () => {
    TestBed.runInInjectionContext(() => service.getNotasByProyectoId(() => 2));
    TestBed.tick();
    http.expectOne('/api/proyects/2/notas').flush([]);
  });

  it('getNotasByProyectoId should not request without id and be undefined when logged out', () => {
    TestBed.runInInjectionContext(() => service.getNotasByProyectoId(() => null));
    TestBed.tick();
    http.expectNone(() => true);

    TestBed.inject(AuthService).isLoggedIn.set(false);
    expect(TestBed.runInInjectionContext(() => service.getNotasByProyectoId(() => 2))).toBeUndefined();
  });

  it.each<HttpCase>([
    { name: 'getNotaById', call: () => service.getNotaById(1), method: 'GET', url: '/api/notas/1' },
    { name: 'createNota', call: () => service.createNota(2, { titulo: 'n' } as never), method: 'POST', url: '/api/proyects/2/notas', body: { titulo: 'n' } },
    { name: 'updateNota', call: () => service.updateNota(1, { titulo: 'm' } as never), method: 'PUT', url: '/api/notas/1', body: { titulo: 'm' } },
    { name: 'getNotasByTareaId', call: () => service.getNotasByTareaId(5), method: 'GET', url: '/api/tareas/5/notas' },
    { name: 'createNotaTarea', call: () => service.createNotaTarea(5, { titulo: 'n' } as never), method: 'POST', url: '/api/tareas/5/notas', body: { titulo: 'n' } },
    { name: 'deleteNota', call: () => service.deleteNota(1), method: 'DELETE', url: '/api/notas/1' },
  ])('$name should call $method $url', (c) => expectHttpCall(http, c));
});
