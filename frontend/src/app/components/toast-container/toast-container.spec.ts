import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastContainer } from './toast-container';
import { ToastService } from '../../services/toast.service';
import { ToastType } from '../../models/toast.model';

describe('ToastContainer', () => {
  let component: ToastContainer;
  let fixture: ComponentFixture<ToastContainer>;
  let toastService: ToastService;

  const el = () => fixture.nativeElement as HTMLElement;
  const items = () => Array.from(el().querySelectorAll<HTMLElement>('.toast-item'));
  const render = () => {
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastContainer],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainer);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    await fixture.whenStable();
  });

  afterEach(() => {
    toastService.clear();
  });

  it('should create with no toasts', () => {
    expect(component).toBeTruthy();
    expect(items().length).toBe(0);
    expect(el().querySelector('aside')?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders one item per toast with title and message', () => {
    toastService.success('Guardado', { title: 'OK', duration: 0 });
    toastService.info('Hola', { duration: 0 });
    render();
    const list = items();
    expect(list.length).toBe(2);
    expect(list[0].querySelector('h4')?.textContent).toContain('OK');
    expect(list[0].textContent).toContain('Guardado');
    expect(list[1].querySelector('h4')).toBeNull();
    expect(list[1].textContent).toContain('Hola');
  });

  it.each<[ToastType, string]>([
    ['error', 'alert'],
    ['warning', 'alert'],
    ['success', 'status'],
    ['info', 'status'],
  ])('uses role for %s toasts = %s', (type, role) => {
    toastService.show('msg', type, { duration: 0 });
    render();
    expect(items()[0].getAttribute('role')).toBe(role);
  });

  it('keeps the base class and adds type classes to the card', () => {
    toastService.error('fail', { duration: 0 });
    render();
    const card = items()[0];
    expect(card.classList.contains('toast-item')).toBe(true);
    expect(card.classList.contains('border-danger/30')).toBe(true);
  });

  it('renders the progress bar only when duration > 0', () => {
    toastService.info('persistent', { duration: 0 });
    toastService.info('timed', { duration: 1500 });
    render();
    const [persistent, timed] = items();
    expect(persistent.querySelector('.toast-progress')).toBeNull();
    const bar = timed.querySelector<HTMLElement>('.toast-progress');
    expect(bar).not.toBeNull();
    expect(bar!.style.animationDuration).toBe('1500ms');
    expect(bar!.classList.contains('bg-accent')).toBe(true);
  });

  it('close button removes the toast', () => {
    toastService.info('bye', { duration: 0 });
    render();
    (items()[0].querySelector('button[aria-label="Cerrar notificación"]') as HTMLButtonElement).click();
    render();
    expect(toastService.toasts().length).toBe(0);
    expect(items().length).toBe(0);
  });

  it('action button runs the callback and removes the toast', () => {
    const onClick = vi.fn();
    toastService.info('Tarea borrada', { duration: 0, action: { label: 'Deshacer', onClick } });
    render();
    const actionBtn = Array.from(items()[0].querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Deshacer'),
    ) as HTMLButtonElement;
    expect(actionBtn).toBeTruthy();
    actionBtn.click();
    render();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(items().length).toBe(0);
  });

  it('handleAction is a no-op for toasts without action', () => {
    const id = toastService.info('x', { duration: 0 });
    const toast = toastService.toasts()[0];
    component.handleAction(toast);
    expect(toastService.toasts().map((t) => t.id)).toEqual([id]);
  });

  it('removeToast delegates to ToastService.remove', () => {
    const spy = vi.spyOn(toastService, 'remove');
    component.removeToast('abc');
    expect(spy).toHaveBeenCalledWith('abc');
  });

  describe('class helpers', () => {
    it.each<[ToastType, string, string, string]>([
      ['success', 'border-success/30', 'text-success', 'bg-success'],
      ['error', 'border-danger/30', 'text-danger', 'bg-danger'],
      ['warning', 'border-amber-500/30', 'text-amber-400', 'bg-amber-400'],
      ['info', 'border-accent/30', 'text-accent', 'bg-accent'],
    ])('%s', (type, card, icon, bar) => {
      expect(component.getToastCardClass(type)).toContain(card);
      expect(component.getIconWrapperClass(type)).toContain(icon);
      expect(component.getProgressBarClass(type)).toBe(bar);
    });

    it('falls back to info styles for unknown types', () => {
      const unknown = 'other' as ToastType;
      expect(component.getToastCardClass(unknown)).toBe(component.getToastCardClass('info'));
      expect(component.getIconWrapperClass(unknown)).toBe(component.getIconWrapperClass('info'));
      expect(component.getProgressBarClass(unknown)).toBe('bg-accent');
    });
  });
});
