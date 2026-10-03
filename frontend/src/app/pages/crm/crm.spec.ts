import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { Crm } from './crm';
import { PersonaService } from '../../services/persona.service';
import { ToastService } from '../../services/toast.service';
import { PersonaResponse } from '../../models/persona.model';

function persona(over: Partial<PersonaResponse>): PersonaResponse {
  return {
    id: 1,
    user_id: 1,
    nombre: 'Ana',
    fecha_creacion: '2026-01-01T00:00:00Z',
    eliminado: false,
    es_yo: false,
    ...over,
  };
}

describe('Crm', () => {
  let component: Crm;
  let fixture: ComponentFixture<Crm>;
  let personaService: {
    personaResource: {
      value: ReturnType<typeof signal<PersonaResponse[] | undefined>>;
      isLoading: ReturnType<typeof signal<boolean>>;
      error: ReturnType<typeof signal<unknown>>;
      reload: ReturnType<typeof vi.fn>;
    };
    reload: ReturnType<typeof vi.fn>;
    createPersona: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const personas: PersonaResponse[] = [
    persona({ id: 1, nombre: 'Yo Mismo', es_yo: true }),
    persona({ id: 2, nombre: 'Ana Pérez', alias: 'anita', fecha_creacion: '2026-01-01T00:00:00Z' }),
    persona({ id: 3, nombre: 'Bruno', alias: 'bru', fecha_creacion: '2026-03-01T00:00:00Z' }),
    persona({ id: 4, nombre: 'Borrado', eliminado: true }),
    persona({ id: 5, nombre: 'Carla', fecha_creacion: '2026-02-01T00:00:00Z' }),
  ];

  beforeEach(async () => {
    personaService = {
      personaResource: {
        value: signal<PersonaResponse[] | undefined>(personas),
        isLoading: signal(false),
        error: signal<unknown>(undefined),
        reload: vi.fn(),
      },
      reload: vi.fn(),
      createPersona: vi.fn().mockReturnValue(of(persona({ id: 9 }))),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Crm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PersonaService, useValue: personaService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Crm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('getMyProfile returns the non-deleted es_yo persona', () => {
    expect(component.getMyProfile(personas)?.id).toBe(1);
    expect(component.getMyProfile([persona({ es_yo: true, eliminado: true })])).toBeUndefined();
    expect(component.getMyProfile(undefined as unknown as PersonaResponse[])).toBeUndefined();
  });

  it('getFilteredContacts excludes self/deleted and sorts by fecha_creacion DESC', () => {
    expect(component.getFilteredContacts(personas).map((p) => p.id)).toEqual([3, 5, 2]);
    expect(component.getFilteredContacts(undefined as unknown as PersonaResponse[])).toEqual([]);
  });

  it('getFilteredContacts filters by nombre or alias, case-insensitive and trimmed', () => {
    component.searchQuery.set('  ANA ');
    expect(component.getFilteredContacts(personas).map((p) => p.id)).toEqual([2]);
    component.searchQuery.set('bru');
    expect(component.getFilteredContacts(personas).map((p) => p.id)).toEqual([3]);
    component.searchQuery.set('zzz');
    expect(component.getFilteredContacts(personas)).toEqual([]);
  });

  it('getStats counts active personas and contacts', () => {
    expect(component.getStats(personas)).toEqual({ total: 4, contactos: 3 });
    expect(component.getStats([])).toEqual({ total: 0, contactos: 0 });
  });

  it('reload calls the service and resets isRotating after 600ms', () => {
    vi.useFakeTimers();
    component.reload();
    expect(personaService.reload).toHaveBeenCalled();
    expect(component.isRotating()).toBe(true);
    vi.advanceTimersByTime(600);
    expect(component.isRotating()).toBe(false);
  });

  it('open/close create modal', () => {
    component.openCreateModal();
    expect(component.showModal()).toBe(true);
    component.closeModal();
    expect(component.showModal()).toBe(false);
  });

  it('handleCreatePersona success closes modal, reloads and toasts', () => {
    component.openCreateModal();
    component.handleCreatePersona({ nombre: 'Nueva' });
    expect(personaService.createPersona).toHaveBeenCalledWith({ nombre: 'Nueva' });
    expect(component.isSubmitting()).toBe(false);
    expect(component.showModal()).toBe(false);
    expect(personaService.reload).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Persona registrada correctamente');
  });

  it('handleCreatePersona error shows backend message and keeps modal open', () => {
    personaService.createPersona.mockReturnValue(
      throwError(() => ({ error: { message: 'Duplicado' } })),
    );
    component.openCreateModal();
    component.handleCreatePersona({ nombre: 'X' });
    expect(component.isSubmitting()).toBe(false);
    expect(component.showModal()).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('Duplicado');
  });

  it('handleCreatePersona error falls back to default message', () => {
    personaService.createPersona.mockReturnValue(throwError(() => ({})));
    component.handleCreatePersona({ nombre: 'X' });
    expect(toast.error).toHaveBeenCalledWith('Error al registrar la persona');
  });

  it('handleCreatePersona error never shows "[object Object]" for JSON bodies without message', () => {
    personaService.createPersona.mockReturnValue(throwError(() => ({ error: { code: 409 } })));
    component.handleCreatePersona({ nombre: 'X' });
    expect(toast.error).toHaveBeenCalledWith('Error al registrar la persona');
  });

  it('renders a card per filtered contact', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('app-persona-card').length).toBe(3);
  });
});
