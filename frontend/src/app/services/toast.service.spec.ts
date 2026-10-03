import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add a toast with defaults', () => {
    const id = service.show('Hola');
    const [toast] = service.toasts();

    expect(toast.id).toBe(id);
    expect(toast.message).toBe('Hola');
    expect(toast.type).toBe('info');
    expect(toast.duration).toBe(4000);
  });

  it.each([
    ['success', (s: ToastService) => s.success('x')],
    ['error', (s: ToastService) => s.error('x')],
    ['warning', (s: ToastService) => s.warning('x')],
    ['info', (s: ToastService) => s.info('x')],
  ] as const)('%s() should create a toast of that type', (type, create) => {
    create(service);
    expect(service.toasts()[0].type).toBe(type);
  });

  it('should pass through title and action options', () => {
    const action = { label: 'Deshacer', onClick: vi.fn() };
    service.success('Guardado', { title: 'OK', action });
    const [toast] = service.toasts();
    expect(toast.title).toBe('OK');
    expect(toast.action).toBe(action);
  });

  it('should auto-remove the toast after its duration', () => {
    service.show('temporal', 'info', { duration: 1000 });
    vi.advanceTimersByTime(999);
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });

  it('should keep persistent toasts (duration 0)', () => {
    service.show('persistente', 'info', { duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].timeoutId).toBeUndefined();
  });

  it('remove should delete only the given toast and cancel its timer', () => {
    const a = service.show('a');
    service.show('b');
    service.remove(a);

    expect(service.toasts().map((t) => t.message)).toEqual(['b']);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('clear should remove every toast and timer', () => {
    service.show('a');
    service.show('b');
    service.clear();

    expect(service.toasts()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('should generate unique ids', () => {
    const ids = new Set([service.show('1'), service.show('2'), service.show('3')]);
    expect(ids.size).toBe(3);
  });
});
