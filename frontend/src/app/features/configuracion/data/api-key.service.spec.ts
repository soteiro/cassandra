import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { APIKeyService } from './api-key.service';
import { ServerConfigService } from '../../../core/server/server-config.service';
import { setupHttpTesting } from '../../../../testing/http-testing';

describe('APIKeyService', () => {
  let http: HttpTestingController;
  let service: APIKeyService;

  beforeEach(() => {
    http = setupHttpTesting();
    service = TestBed.inject(APIKeyService);
  });
  afterEach(() => http.verify());

  it('lists metadata, emits a key and revokes it with the authenticated endpoints', () => {
    service.list().subscribe();
    const list = http.expectOne('/api/api-keys');
    expect(list.request.method).toBe('GET');
    list.flush([]);
    const body = { nombre: 'Asistente', scopes: ['memory:read' as const], proyecto_ids: [12] };
    const result = vi.fn();
    service.create(body).subscribe(result);
    const create = http.expectOne('/api/api-keys');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(body);
    create.flush({ id: 1, token: 'fake-key' }, { status: 201, statusText: 'Created' });
    expect(result).toHaveBeenCalledWith({ id: 1, token: 'fake-key' });
    service.revoke(1).subscribe();
    const revoke = http.expectOne('/api/api-keys/1');
    expect(revoke.request.method).toBe('DELETE');
    revoke.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('reads the current server URL on every request', () => {
    TestBed.resetTestingModule();
    const apiUrl = signal('https://first.example/api');
    TestBed.configureTestingModule({ providers: [{ provide: ServerConfigService, useValue: { apiUrl } }] });
    http = setupHttpTesting();
    service = TestBed.inject(APIKeyService);
    service.list().subscribe();
    http.expectOne('https://first.example/api/api-keys').flush([]);
    apiUrl.set('https://second.example/api');
    service.revoke(3).subscribe();
    http.expectOne('https://second.example/api/api-keys/3').flush(null);
  });
});
