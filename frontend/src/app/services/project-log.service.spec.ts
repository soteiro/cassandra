import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { AuthService } from './auth.service';
import { ProjectLogService } from './project-log.service';
import { setupHttpTesting } from '../../testing/http-testing';

describe('ProjectLogService', () => {
  let http: HttpTestingController;
  beforeEach(() => { http = setupHttpTesting(); });
  afterEach(() => http.verify());

  it('paginates, searches, and changes project without reusing the old response', () => {
    const id = signal(2), query = signal('memoria'), offset = signal(0);
    TestBed.runInInjectionContext(() => TestBed.inject(ProjectLogService).getByProyectoId(id,query,offset));
    TestBed.tick();
    http.expectOne(r => r.url === '/api/proyects/2/logs' && r.params.get('limit') === '31' && r.params.get('q') === 'memoria' && r.params.get('offset') === '0').flush([]);
    offset.set(30);
    TestBed.tick();
    http.expectOne(r => r.params.get('offset') === '30').flush([]);
    id.set(3); query.set('  otra  '); offset.set(0);
    TestBed.tick();
    http.expectOne(r => r.url === '/api/proyects/3/logs' && r.params.get('q') === 'otra').flush([]);
  });

  it('does not request logs without a session or a project', () => {
    TestBed.inject(AuthService).isLoggedIn.set(false);
    TestBed.runInInjectionContext(() => TestBed.inject(ProjectLogService).getByProyectoId(() => 2,() => '',() => 0));
    TestBed.runInInjectionContext(() => TestBed.inject(ProjectLogService).getByProyectoId(() => 0,() => '',() => 0));
    TestBed.tick();
    http.expectNone(() => true);
  });
});
