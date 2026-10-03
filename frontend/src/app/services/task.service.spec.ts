import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TaskService } from './task.service';
import { AuthService } from './auth.service';
import { expectHttpCall, HttpCase, settle, setupHttpTesting } from '../../testing/http-testing';

describe('TaskService', () => {
  let http: HttpTestingController;
  let service: TaskService;

  beforeEach(() => {
    http = setupHttpTesting();
    service = TestBed.inject(TaskService);
  });

  afterEach(() => http.verify());

  it('getTasksByProyectoId should request the project tasks', async () => {
    const res = TestBed.runInInjectionContext(() => service.getTasksByProyectoId(() => 4));
    TestBed.tick();
    http.expectOne('/api/proyects/4/tareas').flush([{ id: 1 }]);
    await settle();
    expect(res?.value()).toEqual([{ id: 1 }]);
  });

  it('getTasksByProyectoId should not request without id', () => {
    TestBed.runInInjectionContext(() => service.getTasksByProyectoId(() => null));
    TestBed.tick();
    http.expectNone(() => true);
  });

  it.each([
    [undefined, '/api/tareas'],
    ['all', '/api/tareas'],
    ['todas', '/api/tareas'],
    ['En Curso', '/api/tareas?estado=En%20Curso'],
  ])('getAllTasks with estado %s should request %s', (estado, url) => {
    const filter = estado === undefined ? undefined : signal<string | null>(estado);
    TestBed.runInInjectionContext(() => service.getAllTasks(filter));
    TestBed.tick();
    http.expectOne(url).flush([]);
  });

  it('should return undefined resources when logged out', () => {
    TestBed.inject(AuthService).isLoggedIn.set(false);
    TestBed.runInInjectionContext(() => {
      expect(service.getTasksByProyectoId(() => 1)).toBeUndefined();
      expect(service.getAllTasks()).toBeUndefined();
    });
  });

  it.each<HttpCase>([
    { name: 'getTaskById', call: () => service.getTaskById(9), method: 'GET', url: '/api/tareas/9' },
    { name: 'createTask', call: () => service.createTask({ titulo: 'T' } as never), method: 'POST', url: '/api/tareas', body: { titulo: 'T' } },
    { name: 'updateTask', call: () => service.updateTask(9, { estado: 'Terminado' } as never), method: 'PUT', url: '/api/tareas/9', body: { estado: 'Terminado' } },
    { name: 'deleteTask', call: () => service.deleteTask(9), method: 'DELETE', url: '/api/tareas/9' },
  ])('$name should call $method $url', (c) => expectHttpCall(http, c));
});
