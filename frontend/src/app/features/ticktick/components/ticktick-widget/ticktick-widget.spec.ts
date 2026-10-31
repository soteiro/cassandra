import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TickTickWidget } from './ticktick-widget';
import { TickTickToday } from '../../data/ticktick.model';

describe('TickTickWidget', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [TickTickWidget],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }));
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); vi.useRealTimers(); });

  function setup() {
    const fixture = TestBed.createComponent(TickTickWidget);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne((r) => r.url.endsWith('/ticktick/tasks/today'));
    const base: TickTickToday = {
      state: 'ready', date: request.request.params.get('date')!, time_zone: request.request.params.get('time_zone')!,
      tasks: [], fetched_at: new Date().toISOString(), warnings: [], inbox_read: true,
    };
    return { fixture, http, request, base, el: fixture.nativeElement as HTMLElement };
  }

  it('distinguishes complete empty, partial and unconnected states', () => {
    const { fixture, request, base, el } = setup();
    request.flush(base); fixture.detectChanges();
    expect(el.textContent).toContain('No tienes tareas pendientes');
    fixture.componentInstance.data.set({ ...base, state: 'partial', inbox_read: false, warnings: ['No se pudo leer Inbox.'] });
    fixture.detectChanges();
    expect(el.textContent).not.toContain('No tienes tareas pendientes');
    expect(el.textContent).toContain('La consulta está incompleta');
    fixture.componentInstance.data.set({ ...base, state: 'not_connected' });
    fixture.detectChanges();
    expect(el.querySelector('a[href="/configuracion/ticktick"]')?.textContent).toContain('Conectar');
  });

  it('shows read-only tasks and retains their last result on refresh failure', () => {
    const { fixture, http, request, base, el } = setup();
    request.flush({ ...base, tasks: [{ id: 'one', project_id: 'inbox', list: 'Inbox', title: '<script>safe text</script>', priority: 5, due_date: new Date().toISOString(), time_zone: 'UTC', is_all_day: true }] });
    fixture.detectChanges();
    expect(el.textContent).toContain('<script>safe text</script>');
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('input[type="checkbox"]')).toBeNull();
    expect(el.textContent).toContain('Todo el día');
    fixture.componentInstance.load(true);
    const refresh = http.expectOne((r) => r.params.get('refresh') === 'true');
    refresh.flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Se conserva la última consulta');
    expect(el.textContent).toContain('<script>safe text</script>');
  });

  it('clears yesterday before requesting a new civil day', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    const { fixture, http, request, base } = setup();
    request.flush(base);
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fixture.componentInstance.data()).toBeNull();
    const next = http.expectOne((r) => r.params.get('date') === '2026-10-30');
    next.flush({ ...base, date: '2026-10-30' });
  });
});
