import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfirmModal } from './confirm-modal';
import { BackButtonService } from '../../services/back-button.service';

describe('ConfirmModal', () => {
  let component: ConfirmModal;
  let fixture: ComponentFixture<ConfirmModal>;
  let confirmSpy: ReturnType<typeof vi.fn<() => void>>;
  let cancelSpy: ReturnType<typeof vi.fn<() => void>>;

  const el = () => fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(el().querySelectorAll<HTMLButtonElement>('button'));
  const confirmButton = () => buttons()[2];
  const cancelButton = () => buttons()[1];
  const closeButton = () => buttons()[0];

  const open = async (inputs: Record<string, unknown> = {}) => {
    fixture.componentRef.setInput('isOpen', true);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmModal],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmModal);
    component = fixture.componentInstance;
    confirmSpy = vi.fn<() => void>();
    cancelSpy = vi.fn<() => void>();
    component.confirm.subscribe(confirmSpy);
    component.cancel.subscribe(cancelSpy);
    await fixture.whenStable();
  });

  it('should create with default inputs', () => {
    expect(component).toBeTruthy();
    expect(component.isOpen()).toBe(false);
    expect(component.title()).toBe('¿Estás seguro?');
    expect(component.message()).toBe('Esta acción no se puede deshacer.');
    expect(component.confirmText()).toBe('Eliminar');
    expect(component.cancelText()).toBe('Cancelar');
    expect(component.variant()).toBe('danger');
    expect(component.isProcessing()).toBe(false);
  });

  it('renders nothing when closed', () => {
    expect(el().querySelector('.backdrop-layer')).toBeNull();
  });

  it('renders default texts when open', async () => {
    await open();
    expect(el().querySelector('h3')?.textContent).toContain('¿Estás seguro?');
    expect(el().textContent).toContain('Esta acción no se puede deshacer.');
    expect(confirmButton().textContent).toContain('Eliminar');
    expect(cancelButton().textContent).toContain('Cancelar');
  });

  it('renders custom inputs', async () => {
    await open({
      title: 'Borrar tarea',
      message: 'Se perderá todo',
      confirmText: 'Sí, borrar',
      cancelText: 'No',
    });
    expect(el().querySelector('h3')?.textContent).toContain('Borrar tarea');
    expect(el().textContent).toContain('Se perderá todo');
    expect(confirmButton().textContent).toContain('Sí, borrar');
    expect(cancelButton().textContent).toContain('No');
  });

  it('uses danger styles for the confirm button in danger variant', async () => {
    await open();
    expect(confirmButton().classList.contains('bg-danger/80')).toBe(true);
    expect(el().querySelector('.text-danger')).not.toBeNull();
  });

  it('uses primary styles and warning icon in warning variant', async () => {
    await open({ variant: 'warning' });
    expect(confirmButton().classList.contains('bg-primary')).toBe(true);
    expect(el().querySelector('.text-amber-400')).not.toBeNull();
  });

  it('shows no icon in info variant', async () => {
    await open({ variant: 'info' });
    expect(el().querySelector('.text-amber-400')).toBeNull();
    expect(el().querySelector('.bg-danger\\/15')).toBeNull();
    expect(confirmButton().classList.contains('bg-primary')).toBe(true);
  });

  it('emits confirm when the confirm button is clicked', async () => {
    await open();
    confirmButton().click();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it('emits cancel from the cancel and close buttons', async () => {
    await open();
    cancelButton().click();
    closeButton().click();
    expect(cancelSpy).toHaveBeenCalledTimes(2);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('emits cancel on backdrop click but not on dialog click', async () => {
    await open();
    (el().querySelector('.backdrop-layer') as HTMLElement).click();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    (el().querySelector('h3') as HTMLElement).click();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it('disables actions and shows a spinner while processing', async () => {
    await open({ isProcessing: true });
    expect(confirmButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    expect(confirmButton().textContent).toContain('Procesando...');
    expect(confirmButton().textContent).not.toContain('Eliminar');
  });

  it('emits cancel on hardware back button when open', async () => {
    await open();
    await TestBed.inject(BackButtonService).handleBackButton();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it('does not handle back button when closed', async () => {
    fixture.detectChanges();
    await TestBed.inject(BackButtonService).handleBackButton();
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it('unregisters the back button handler when closed again', async () => {
    await open();
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    await fixture.whenStable();
    await TestBed.inject(BackButtonService).handleBackButton();
    expect(cancelSpy).not.toHaveBeenCalled();
  });
});
