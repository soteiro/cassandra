import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ReflexionesView } from './reflexiones-view';
import { ReflexionService } from '../../services/reflexion.service';
import { ToastService } from '../../services/toast.service';
import { ReflexionResponse, ReflexionTipo } from '../../models/reflexion.model';

function refl(id: number, tipo: ReflexionTipo, reflexion = 'texto'): ReflexionResponse {
  return { id, user_id: 1, reflexion, tipo, fecha_creacion: '2026-01-01T00:00:00Z', eliminado: false };
}

describe('ReflexionesView', () => {
  let component: ReflexionesView;
  let fixture: ComponentFixture<ReflexionesView>;
  let tipoArg: () => string | null;
  let resource: {
    value: ReturnType<typeof signal<ReflexionResponse[] | undefined>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<unknown>>;
    reload: ReturnType<typeof vi.fn>;
  };
  let service: {
    getReflexionesByTipo: ReturnType<typeof vi.fn>;
    createReflexion: ReturnType<typeof vi.fn>;
    updateReflexion: ReturnType<typeof vi.fn>;
    deleteReflexion: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    resource = {
      value: signal<ReflexionResponse[] | undefined>([
        refl(1, 'reflexion'),
        refl(2, 'reflexion'),
        refl(3, 'memoria'),
        refl(4, 'evento'),
      ]),
      isLoading: signal(false),
      error: signal<unknown>(undefined),
      reload: vi.fn(),
    };
    service = {
      getReflexionesByTipo: vi.fn((tipo: () => string | null) => {
        tipoArg = tipo;
        return resource;
      }),
      createReflexion: vi.fn().mockReturnValue(of(refl(9, 'reflexion'))),
      updateReflexion: vi.fn().mockReturnValue(of(refl(1, 'reflexion'))),
      deleteReflexion: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ReflexionesView],
      providers: [
        provideRouter([]),
        { provide: ReflexionService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReflexionesView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('setFilter drives the resource tipo signal', () => {
    expect(tipoArg()).toBe('todas');
    component.setFilter('memoria');
    expect(component.activeFilter()).toBe('memoria');
    expect(tipoArg()).toBe('memoria');
  });

  it('stats counts items by tipo', () => {
    expect(component.stats()).toEqual({ total: 4, reflexiones: 2, memorias: 1, eventos: 1 });
    resource.value.set(undefined);
    expect(component.stats()).toEqual({ total: 0, reflexiones: 0, memorias: 0, eventos: 0 });
  });

  it('wordCount counts whitespace-separated words', () => {
    expect(component.wordCount()).toBe(0);
    component.nuevoTexto.set('  hola   mundo\nbonito ');
    expect(component.wordCount()).toBe(3);
  });

  it('avatarUrl depends on the persona input', () => {
    expect(component.avatarUrl).toBe('https://robohash.org/yo?size=200x200');
    fixture.componentRef.setInput('persona', {
      id: 5, user_id: 1, nombre: 'Yo', fecha_creacion: '', eliminado: false,
    });
    expect(component.avatarUrl).toBe('https://robohash.org/5?size=200x200');
  });

  it('createReflexion ignores empty text', () => {
    component.nuevoTexto.set('   ');
    component.createReflexion();
    expect(service.createReflexion).not.toHaveBeenCalled();
  });

  it('createReflexion saves, clears the writer and reloads', () => {
    component.nuevoTexto.set('  idea  ');
    component.setNuevoTipo('evento');
    component.createReflexion();
    expect(service.createReflexion).toHaveBeenCalledWith({ reflexion: 'idea', tipo: 'evento' });
    expect(component.nuevoTexto()).toBe('');
    expect(component.isSubmittingNuevo()).toBe(false);
    expect(resource.reload).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('createReflexion error keeps the text', () => {
    service.createReflexion.mockReturnValue(throwError(() => ({ error: { message: 'fallo' } })));
    component.nuevoTexto.set('idea');
    component.createReflexion();
    expect(component.nuevoTexto()).toBe('idea');
    expect(component.isSubmittingNuevo()).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('fallo');
  });

  it('openEdit / closeEdit manage selection', () => {
    const r = refl(1, 'reflexion');
    component.openEdit(r);
    expect(component.showEditModal()).toBe(true);
    expect(component.selectedReflexion()).toBe(r);
    component.closeEdit();
    expect(component.showEditModal()).toBe(false);
    expect(component.selectedReflexion()).toBeNull();
  });

  it('saveEdit does nothing without selection', () => {
    component.saveEdit({ reflexion: 'x' });
    expect(service.updateReflexion).not.toHaveBeenCalled();
  });

  it('saveEdit updates the selected item and closes', () => {
    component.openEdit(refl(2, 'memoria'));
    component.saveEdit({ reflexion: 'nuevo', tipo: 'memoria' });
    expect(service.updateReflexion).toHaveBeenCalledWith(2, { reflexion: 'nuevo', tipo: 'memoria' });
    expect(component.showEditModal()).toBe(false);
    expect(component.isSubmittingEdit()).toBe(false);
    expect(resource.reload).toHaveBeenCalled();
  });

  it('saveEdit error keeps the modal open', () => {
    service.updateReflexion.mockReturnValue(throwError(() => ({})));
    component.openEdit(refl(2, 'memoria'));
    component.saveEdit({ reflexion: 'nuevo' });
    expect(component.showEditModal()).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('Error al actualizar la entrada');
  });

  it('confirmDelete deletes the selected item', () => {
    component.openDelete(refl(3, 'memoria'));
    expect(component.showDeleteModal()).toBe(true);
    component.confirmDelete();
    expect(service.deleteReflexion).toHaveBeenCalledWith(3);
    expect(component.showDeleteModal()).toBe(false);
    expect(component.itemToDelete()).toBeNull();
    expect(resource.reload).toHaveBeenCalled();
  });

  it('confirmDelete error keeps the modal open', () => {
    service.deleteReflexion.mockReturnValue(throwError(() => ({ error: 'boom' })));
    component.openDelete(refl(3, 'memoria'));
    component.confirmDelete();
    expect(component.showDeleteModal()).toBe(true);
    expect(component.isDeleting()).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('boom');
  });

  it('confirmDelete does nothing without item', () => {
    component.confirmDelete();
    expect(service.deleteReflexion).not.toHaveBeenCalled();
  });

  it('copyContent writes the text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    component.copyContent(refl(1, 'reflexion', 'copiame'));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('copiame');
    await fixture.whenStable();
    expect(toast.success).toHaveBeenCalledWith('Texto copiado al portapapeles');
  });

  it('badge class and icon per tipo', () => {
    expect(component.getBadgeClass('memoria')).toContain('amber');
    expect(component.getBadgeClass('evento')).toContain('blue');
    expect(component.getBadgeClass('reflexion')).toContain('purple');
    expect(component.getBadgeClass('otro' as ReflexionTipo)).toContain('primary');
    expect(component.getTipoIcon('evento')).toBe('📅');
    expect(component.getTipoIcon('otro' as ReflexionTipo)).toBe('✍️');
  });
});
