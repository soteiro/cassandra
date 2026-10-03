import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { StatusService } from './status.service';
import { settle } from '../../testing/http-testing';

describe('StatusService', () => {
  let service: StatusService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StatusService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => http.verify());

  it('should load health, root, db-time and db-version', async () => {
    http.expectOne('/api/health').flush({ status: 'ok' });
    http.expectOne('/api/').flush({ response: 'hi' });
    http.expectOne('/api/db-time').flush({ message: 'm', db_time: 't' });
    http.expectOne('/api/db-version').flush({ message: 'm', status: 's', version_db: '17' });
    await settle();

    expect(service.health.value()).toEqual({ status: 'ok' });
    expect(service.dbVersion.value()?.version_db).toBe('17');
  });

  it('reload should request every endpoint again', async () => {
    for (const url of ['/api/health', '/api/', '/api/db-time', '/api/db-version']) {
      http.expectOne(url).flush({});
    }
    await settle();

    service.reload();
    TestBed.tick();

    for (const url of ['/api/health', '/api/', '/api/db-time', '/api/db-version']) {
      http.expectOne(url).flush({});
    }
  });
});
