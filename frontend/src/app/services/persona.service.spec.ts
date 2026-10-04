import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { PersonaService } from './persona.service';
import { AuthService } from './auth.service';
import { expectHttpCall, HttpCase, settle, setupHttpTesting } from '../../testing/http-testing';

describe('PersonaService', () => {
  let http: HttpTestingController;
  let service: PersonaService;

  beforeEach(async () => {
    http = setupHttpTesting();
    service = TestBed.inject(PersonaService);
    TestBed.tick();
    http.expectOne('/api/personas').flush([{ id: 1 }]);
    await settle();
  });

  afterEach(() => http.verify());

  it('personaResource should load the list when logged in', () => {
    expect(service.personaResource.value()).toEqual([{ id: 1 }]);
  });

  it('reload should request the list again', () => {
    service.reload();
    TestBed.tick();
    http.expectOne('/api/personas').flush([]);
  });

  it('getPersonaById should request the persona', () => {
    TestBed.runInInjectionContext(() => service.getPersonaById(() => 4));
    TestBed.tick();
    http.expectOne('/api/personas/4').flush({ id: 4 });
  });

  it('getPersonaById should be undefined when logged out', () => {
    TestBed.inject(AuthService).isLoggedIn.set(false);
    expect(TestBed.runInInjectionContext(() => service.getPersonaById(() => 4))).toBeUndefined();
  });

  it.each<HttpCase>([
    { name: 'createPersona', call: () => service.createPersona({ nombre: 'Ana' } as never), method: 'POST', url: '/api/personas', body: { nombre: 'Ana' } },
    { name: 'updatePersona', call: () => service.updatePersona(4, { nombre: 'Bea' } as never), method: 'PUT', url: '/api/personas/4', body: { nombre: 'Bea' } },
    { name: 'deletePersona', call: () => service.deletePersona(4), method: 'DELETE', url: '/api/personas/4' },
  ])('$name should call $method $url', (c) => expectHttpCall(http, c));
});
