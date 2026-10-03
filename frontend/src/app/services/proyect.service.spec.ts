import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { proyectService } from './proyect.service';
import { AuthService } from './auth.service';
import { expectHttpCall, HttpCase, settle, setupHttpTesting } from '../../testing/http-testing';

describe('proyectService', () => {
  let http: HttpTestingController;
  let service: proyectService;

  beforeEach(() => {
    http = setupHttpTesting();
    service = TestBed.inject(proyectService);
  });

  afterEach(() => http.verify());

  it('proyectResource should load the project list when logged in', async () => {
    TestBed.tick();
    http.expectOne('/api/proyects').flush([{ id: 1 }]);
    await settle();
    expect(service.proyectResource.value()).toEqual([{ id: 1 }]);
  });

  it('proyectResource should not request anything when logged out', () => {
    TestBed.inject(AuthService).isLoggedIn.set(false);
    TestBed.tick();
    http.expectNone('/api/proyects');
  });

  it('reload should request the list again', async () => {
    TestBed.tick();
    http.expectOne('/api/proyects').flush([]);
    await settle();
    service.reload();
    TestBed.tick();
    http.expectOne('/api/proyects').flush([]);
  });

  describe('resources by id', () => {
    beforeEach(() => {
      TestBed.tick();
      http.expectOne('/api/proyects').flush([]);
    });

    it('getProyectById should follow the id signal', async () => {
      const id = signal<string | null>('7');
      const res = TestBed.runInInjectionContext(() => service.getProyectById(id));
      TestBed.tick();
      http.expectOne('/api/proyects/7').flush({ id: 7 });
      await settle();
      expect(res?.value()).toEqual({ id: 7 });

      id.set('8');
      TestBed.tick();
      http.expectOne('/api/proyects/8').flush({ id: 8 });
    });

    it('getSubproyectos should request the children of the project', () => {
      TestBed.runInInjectionContext(() => service.getSubproyectos(() => '3'));
      TestBed.tick();
      http.expectOne('/api/proyects/3/subproyectos').flush([]);
    });

    it('should not request anything without id', () => {
      TestBed.runInInjectionContext(() => service.getProyectById(() => null));
      TestBed.tick();
      http.expectNone(() => true);
    });
  });

  it('should return undefined resources when logged out', () => {
    TestBed.inject(AuthService).isLoggedIn.set(false);
    TestBed.runInInjectionContext(() => {
      expect(service.getProyectById(() => '1')).toBeUndefined();
      expect(service.getSubproyectos(() => '1')).toBeUndefined();
    });
  });

  it.each<HttpCase>([
    { name: 'create', call: () => service.createProyect({ nombre: 'P' } as never), method: 'POST', url: '/api/proyects', body: { nombre: 'P' } },
    { name: 'update', call: () => service.updateProyect(2, { estado: 'Pausado' }), method: 'PUT', url: '/api/proyects/2', body: { estado: 'Pausado' } },
    { name: 'delete', call: () => service.deleteProyect(2), method: 'DELETE', url: '/api/proyects/2' },
  ])('$name should call $method $url', (c) => {
    TestBed.tick();
    http.expectOne('/api/proyects').flush([]);
    expectHttpCall(http, c);
  });
});
