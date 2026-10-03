import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { DocumentoService } from './documento.service';
import { AuthService } from './auth.service';
import { expectHttpCall, HttpCase, setupHttpTesting } from '../../testing/http-testing';

describe('DocumentoService', () => {
  let http: HttpTestingController;
  let service: DocumentoService;

  beforeEach(() => {
    http = setupHttpTesting();
    service = TestBed.inject(DocumentoService);
  });

  afterEach(() => http.verify());

  it.each([
    [undefined, '/api/proyects/3/documentos'],
    ['todas', '/api/proyects/3/documentos'],
    ['todos', '/api/proyects/3/documentos'],
    ['diseño técnico', '/api/proyects/3/documentos?tipo=dise%C3%B1o%20t%C3%A9cnico'],
  ])('getDocumentosByProyectoId with tipo %s should request %s', (tipo, url) => {
    TestBed.runInInjectionContext(() =>
      service.getDocumentosByProyectoId(() => 3, tipo === undefined ? undefined : () => tipo),
    );
    TestBed.tick();
    http.expectOne(url).flush([]);
  });

  it('getDocumentosByProyectoId should not request without id and be undefined when logged out', () => {
    TestBed.runInInjectionContext(() => service.getDocumentosByProyectoId(() => null));
    TestBed.tick();
    http.expectNone(() => true);

    TestBed.inject(AuthService).isLoggedIn.set(false);
    expect(TestBed.runInInjectionContext(() => service.getDocumentosByProyectoId(() => 3))).toBeUndefined();
  });

  it.each<HttpCase>([
    { name: 'getDocumentoById', call: () => service.getDocumentoById(1), method: 'GET', url: '/api/documentos/1' },
    { name: 'createDocumento', call: () => service.createDocumento(3, { titulo: 'd' } as never), method: 'POST', url: '/api/proyects/3/documentos', body: { titulo: 'd' } },
    { name: 'updateDocumento', call: () => service.updateDocumento(1, { titulo: 'e' } as never), method: 'PUT', url: '/api/documentos/1', body: { titulo: 'e' } },
    { name: 'deleteDocumento', call: () => service.deleteDocumento(1), method: 'DELETE', url: '/api/documentos/1' },
  ])('$name should call $method $url', (c) => expectHttpCall(http, c));
});
