import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { PersonaDetails } from './persona-details';
import { PersonaService } from '../../services/persona.service';
import { InteraccionService } from '../../services/interaccion.service';
import { ToastService } from '../../services/toast.service';
import { PersonaResponse } from '../../models/persona.model';
import { InteraccionResponse } from '../../models/interaccion.model';

function fakeResource<T>(value: T) {
  return {
    value: signal<T>(value),
    isLoading: signal(false),
    error: signal<unknown>(undefined),
    reload: vi.fn(),
  };
}

const persona: PersonaResponse = {
  id: 5,
  user_id: 1,
  nombre: 'Ana',
  alias: 'anita',
  entorno: 'Trabajo',
  fecha_creacion: '2026-01-01T00:00:00Z',
  eliminado: false,
  es_yo: false,
};

const interaccion: InteraccionResponse = {
  id: 20,
  user_id: 1,
  persona_id: 5,
  interaccion: 'Hola',
  fecha_creacion: '2026-01-02T00:00:00Z',
  eliminado: false,
};

type Internals = {
  id: () => string | null;
  personaIdNumber: () => number;
};

describe('PersonaDetails', () => {
  let component: PersonaDetails;
  let fixture: ComponentFixture<PersonaDetails>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let personaRes: ReturnType<typeof fakeResource<PersonaResponse | undefined>>;
  let interRes: ReturnType<typeof fakeResource<InteraccionResponse[] | undefined>>;
  let personaService: {
    getPersonaById: ReturnType<typeof vi.fn>;
    updatePersona: ReturnType<typeof vi.fn>;
    deletePersona: ReturnType<typeof vi.fn>;
    reload: ReturnType<typeof vi.fn>;
  };
  let interaccionService: {
    getInteraccionesByPersonaId: ReturnType<typeof vi.fn>;
    createInteraccion: ReturnType<typeof vi.fn>;
    updateInteraccion: ReturnType<typeof vi.fn>;
    deleteInteraccion: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ id: '5' }));
    personaRes = fakeResource<PersonaResponse | undefined>(persona);
    interRes = fakeResource<InteraccionResponse[] | undefined>([interaccion]);
    personaService = {
      getPersonaById: vi.fn().mockReturnValue(personaRes),
      updatePersona: vi.fn().mockReturnValue(of(persona)),
      deletePersona: vi.fn().mockReturnValue(of(undefined)),
      reload: vi.fn(),
    };
    interaccionService = {
      getInteraccionesByPersonaId: vi.fn().mockReturnValue(interRes),
      createInteraccion: vi.fn().mockReturnValue(of(interaccion)),
      updateInteraccion: vi.fn(),
      deleteInteraccion: vi.fn(),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PersonaDetails],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
        { provide: PersonaService, useValue: personaService },
        { provide: InteraccionService, useValue: interaccionService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonaDetails);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });

  it('should create and read the id from the route', () => {
    const c = component as unknown as Internals;
    expect(component).toBeTruthy();
    expect(c.id()).toBe('5');
    expect(c.personaIdNumber()).toBe(5);
    expect(component.avatarUrl).toBe('https://robohash.org/5?size=200x200');
  });

  it('passes an id getter bound to the route to the resources', () => {
    const idFn = personaService.getPersonaById.mock.calls[0][0] as () => string | null;
    const interIdFn = interaccionService.getInteraccionesByPersonaId.mock.calls[0][0] as () =>
      | string
      | null;
    params.next(convertToParamMap({ id: '8' }));
    expect(idFn()).toBe('8');
    expect(interIdFn()).toBe('8');
  });

  it('avatarUrl falls back when there is no id', () => {
    params.next(convertToParamMap({}));
    expect(component.avatarUrl).toBe('https://robohash.org/1?size=200x200');
  });

  it('getEntornoBadgeClass maps entornos to colours', () => {
    expect(component.getEntornoBadgeClass(undefined)).toContain('text-text-muted');
    expect(component.getEntornoBadgeClass(' Trabajo ')).toContain('blue');
    expect(component.getEntornoBadgeClass('Cliente')).toContain('purple');
    expect(component.getEntornoBadgeClass('Familia')).toContain('rose');
    expect(component.getEntornoBadgeClass('Amigos')).toContain('emerald');
    expect(component.getEntornoBadgeClass('Inversión')).toContain('amber');
    expect(component.getEntornoBadgeClass('Mentor')).toContain('cyan');
    expect(component.getEntornoBadgeClass('Otro')).toContain('primary');
  });

  it('saveEditPersona success updates, closes modal and reloads', () => {
    component.openEditModal();
    component.saveEditPersona({ nombre: 'Ana B' });
    expect(personaService.updatePersona).toHaveBeenCalledWith(5, { nombre: 'Ana B' });
    expect(component.showEditModal()).toBe(false);
    expect(component.isSubmittingEdit()).toBe(false);
    expect(personaRes.reload).toHaveBeenCalled();
    expect(personaService.reload).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Perfil actualizado correctamente');
  });

  it('saveEditPersona error keeps the modal open', () => {
    personaService.updatePersona.mockReturnValue(throwError(() => ({ error: { message: 'mal' } })));
    component.openEditModal();
    component.saveEditPersona({ nombre: 'X' });
    expect(component.showEditModal()).toBe(true);
    expect(component.isSubmittingEdit()).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('mal');
  });

  it('confirmDeletePersona success refreshes the global list and navigates to /crm', () => {
    component.openDeleteModal();
    component.confirmDeletePersona();
    expect(personaService.deletePersona).toHaveBeenCalledWith(5);
    expect(component.showDeleteModal()).toBe(false);
    expect(component.isDeleting()).toBe(false);
    expect(personaService.reload).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/crm']);
  });

  it('confirmDeletePersona error does not navigate', () => {
    personaService.deletePersona.mockReturnValue(throwError(() => ({})));
    component.openDeleteModal();
    component.confirmDeletePersona();
    expect(component.showDeleteModal()).toBe(true);
    expect(personaService.reload).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Error al eliminar la persona');
  });

  it('closeEditModal / closeDeleteModal hide modals', () => {
    component.openEditModal();
    component.closeEditModal();
    component.openDeleteModal();
    component.closeDeleteModal();
    expect(component.showEditModal()).toBe(false);
    expect(component.showDeleteModal()).toBe(false);
  });

  it('createInteraccion ignores empty text', () => {
    component.nuevaInteraccionTexto.set('   ');
    component.createInteraccion();
    expect(interaccionService.createInteraccion).not.toHaveBeenCalled();
  });

  it('createInteraccion ignores missing persona id', () => {
    params.next(convertToParamMap({}));
    component.nuevaInteraccionTexto.set('hola');
    component.createInteraccion();
    expect(interaccionService.createInteraccion).not.toHaveBeenCalled();
  });

  it('createInteraccion success clears the form and reloads', () => {
    component.showAddInteraccion.set(true);
    component.nuevaInteraccionTexto.set('  charla  ');
    component.createInteraccion();
    expect(interaccionService.createInteraccion).toHaveBeenCalledWith(5, { interaccion: 'charla' });
    expect(component.nuevaInteraccionTexto()).toBe('');
    expect(component.showAddInteraccion()).toBe(false);
    expect(component.isSubmittingInteraccion()).toBe(false);
    expect(interRes.reload).toHaveBeenCalled();
  });

  it('createInteraccion error keeps the text', () => {
    interaccionService.createInteraccion.mockReturnValue(throwError(() => ({ error: 'x' })));
    component.nuevaInteraccionTexto.set('charla');
    component.createInteraccion();
    expect(component.nuevaInteraccionTexto()).toBe('charla');
    expect(component.isSubmittingInteraccion()).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('x');
  });

  it('opens and closes the interaction detail drawer', () => {
    component.openInteraccionDetail(interaccion);
    expect(component.selectedInteraccion()).toBe(interaccion);
    expect(component.showDetailDrawer()).toBe(true);
    component.closeInteraccionDetail();
    expect(component.selectedInteraccion()).toBeNull();
    expect(component.showDetailDrawer()).toBe(false);
  });

  it('onInteraccionChanged reloads interactions', () => {
    component.onInteraccionChanged();
    expect(interRes.reload).toHaveBeenCalled();
  });

  it('renders the persona name', () => {
    expect(fixture.nativeElement.textContent).toContain('Ana');
  });
});
