import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { InteraccionModal } from './interaccion-modal';
import { InteraccionService } from '../../services/interaccion.service';
import { ToastService } from '../../services/toast.service';
import { InteraccionResponse } from '../../models/interaccion.model';

const item: InteraccionResponse = {
  id: 11,
  user_id: 1,
  persona_id: 2,
  interaccion: 'Tomamos café',
  fecha_creacion: '2026-01-01T00:00:00Z',
  eliminado: false,
};

describe('InteraccionModal', () => {
  let component: InteraccionModal;
  let fixture: ComponentFixture<InteraccionModal>;
  let service: { updateInteraccion: ReturnType<typeof vi.fn>; deleteInteraccion: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let events: string[];

  beforeEach(async () => {
    service = {
      updateInteraccion: vi.fn().mockReturnValue(of(item)),
      deleteInteraccion: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [InteraccionModal],
      providers: [
        provideRouter([]),
        { provide: InteraccionService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InteraccionModal);
    component = fixture.componentInstance;
    events = [];
    component.close.subscribe(() => events.push('close'));
    component.updated.subscribe(() => events.push('updated'));
    component.deleted.subscribe(() => events.push('deleted'));
    fixture.componentRef.setInput('interaccion', item);
    fixture.componentRef.setInput('isOpen', true);
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('should create and cache the displayed item', () => {
    expect(component).toBeTruthy();
    expect(component.displayedItem()).toEqual(item);
    expect(component.editingText()).toBe('Tomamos café');
  });

  it('keeps the displayed item when the input becomes null', async () => {
    fixture.componentRef.setInput('interaccion', null);
    await fixture.whenStable();
    expect(component.displayedItem()).toEqual(item);
  });

  it('exits edit mode when closed', async () => {
    component.startEdit();
    fixture.componentRef.setInput('isOpen', false);
    await fixture.whenStable();
    expect(component.isEditing()).toBe(false);
  });

  it('cancelEdit restores the original text', () => {
    component.startEdit();
    component.editingText.set('cambio');
    component.cancelEdit();
    expect(component.isEditing()).toBe(false);
    expect(component.editingText()).toBe('Tomamos café');
  });

  it('saveEdit rejects empty text', () => {
    component.editingText.set('   ');
    component.saveEdit();
    expect(toast.error).toHaveBeenCalledWith('El texto de la interacción no puede estar vacío');
    expect(service.updateInteraccion).not.toHaveBeenCalled();
  });

  it('saveEdit updates and emits updated', () => {
    component.startEdit();
    component.editingText.set('  nuevo  ');
    component.saveEdit();
    expect(service.updateInteraccion).toHaveBeenCalledWith(11, { interaccion: 'nuevo' });
    expect(component.isEditing()).toBe(false);
    expect(component.isSubmitting()).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Interacción actualizada');
    expect(events).toEqual(['updated']);
  });

  it('saveEdit error shows message and stays in edit mode', () => {
    service.updateInteraccion.mockReturnValue(throwError(() => ({ error: { message: 'nope' } })));
    component.startEdit();
    component.saveEdit();
    expect(component.isEditing()).toBe(true);
    expect(component.isSubmitting()).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('nope');
    expect(events).toEqual([]);
  });

  it('confirmDelete deletes, emits deleted and closes', () => {
    component.openDeleteModal();
    expect(component.showDeleteConfirm()).toBe(true);
    component.confirmDelete();
    expect(service.deleteInteraccion).toHaveBeenCalledWith(11);
    expect(component.showDeleteConfirm()).toBe(false);
    expect(component.isDeleting()).toBe(false);
    expect(events).toEqual(['deleted', 'close']);
  });

  it('confirmDelete error shows fallback message', () => {
    service.deleteInteraccion.mockReturnValue(throwError(() => ({})));
    component.openDeleteModal();
    component.confirmDelete();
    expect(toast.error).toHaveBeenCalledWith('Error al eliminar interacción');
    expect(component.showDeleteConfirm()).toBe(true);
    expect(events).toEqual([]);
  });

  it('closeDeleteModal hides the confirm', () => {
    component.openDeleteModal();
    component.closeDeleteModal();
    expect(component.showDeleteConfirm()).toBe(false);
  });

  it('onBackdropClick closes only when clicking the backdrop layer', () => {
    const inner = document.createElement('div');
    component.onBackdropClick({ target: inner } as unknown as MouseEvent);
    expect(events).toEqual([]);
    const backdrop = document.createElement('div');
    backdrop.classList.add('backdrop-layer');
    component.onBackdropClick({ target: backdrop } as unknown as MouseEvent);
    expect(events).toEqual(['close']);
  });

  it('copyText writes to the clipboard and flags isCopied for 2s', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    component.copyText();
    await vi.advanceTimersByTimeAsync(0);

    expect(writeText).toHaveBeenCalledWith('Tomamos café');
    expect(component.isCopied()).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Texto copiado al portapapeles');
    vi.advanceTimersByTime(2000);
    expect(component.isCopied()).toBe(false);
  });
});
