import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { Proyectos } from './proyectos';
import { proyectService } from '../../services/proyect.service';
import { ToastService } from '../../services/toast.service';
import { ProjectResponse } from '../../models/proyect.model';

function proj(over: Partial<ProjectResponse>): ProjectResponse {
  return {
    id: 1,
    nombre: 'P',
    descripcion: '',
    comentario: '',
    fecha_creacion: '2026-01-01T00:00:00Z',
    estado: 'En Proceso',
    por_que: '',
    para_que: '',
    criterio_finalizacion: '',
    prioridad: 'Media',
    proyecto_padre_id: null,
    ...over,
  };
}

describe('Proyectos', () => {
  let component: Proyectos;
  let fixture: ComponentFixture<Proyectos>;
  let service: {
    proyectResource: {
      value: ReturnType<typeof signal<ProjectResponse[] | undefined>>;
      isLoading: ReturnType<typeof signal<boolean>>;
      error: ReturnType<typeof signal<unknown>>;
      reload: ReturnType<typeof vi.fn>;
    };
    reload: ReturnType<typeof vi.fn>;
    createProyect: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const projects: ProjectResponse[] = [
    proj({ id: 1, nombre: 'Baja vieja', prioridad: 'Baja', fecha_creacion: '2025-01-01T00:00:00Z' }),
    proj({ id: 2, nombre: 'Critica', prioridad: 'Critica' }),
    proj({ id: 3, nombre: 'Alta hecha', prioridad: 'Alta', estado: 'Completado' }),
    proj({ id: 4, nombre: 'Media nueva', prioridad: 'Media', fecha_creacion: '2026-05-01T00:00:00Z' }),
    proj({ id: 5, nombre: 'Media vieja', prioridad: 'Media', fecha_creacion: '2026-01-01T00:00:00Z', para_que: 'ganar dinero' }),
    proj({ id: 6, nombre: 'Sub', prioridad: 'Critica', proyecto_padre_id: 2 }),
    proj({ id: 7, nombre: 'Cancelado', prioridad: 'Baja', estado: 'Cancelado', fecha_creacion: '2024-01-01T00:00:00Z' }),
  ];

  beforeEach(async () => {
    service = {
      proyectResource: {
        value: signal<ProjectResponse[] | undefined>(projects),
        isLoading: signal(false),
        error: signal<unknown>(undefined),
        reload: vi.fn(),
      },
      reload: vi.fn(),
      createProyect: vi.fn().mockReturnValue(of(proj({ id: 99 }))),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Proyectos],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: proyectService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Proyectos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('does not read a failed resource while rendering the retry state', () => {
    service.proyectResource.error.set(new Error('Sin conexión'));
    const value = vi.spyOn(service.proyectResource, 'value').mockImplementation(() => {
      throw new Error('A failed resource has no readable value');
    });
    expect(component.potentialParents()).toEqual([]);
    expect(value).not.toHaveBeenCalled();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('potentialParents returns only root projects', () => {
    expect(component.potentialParents().map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 7]);
    service.proyectResource.value.set(undefined);
    expect(component.potentialParents()).toEqual([]);
  });

  it('getFilteredProjects hides subprojects and sorts by priority then fecha DESC', () => {
    expect(component.getFilteredProjects(projects).map((p) => p.id)).toEqual([2, 3, 4, 5, 1, 7]);
    expect(component.getFilteredProjects(undefined as unknown as ProjectResponse[])).toEqual([]);
  });

  it('getFilteredProjects searches nombre/descripcion/para_que/criterio', () => {
    component.searchQuery.set(' DINERO ');
    expect(component.getFilteredProjects(projects).map((p) => p.id)).toEqual([5]);
    component.searchQuery.set('media');
    expect(component.getFilteredProjects(projects).map((p) => p.id)).toEqual([4, 5]);
  });

  it('getFilteredProjects applies status filters', () => {
    component.statusFilter.set('active');
    expect(component.getFilteredProjects(projects).map((p) => p.id)).toEqual([2, 4, 5, 1]);
    component.statusFilter.set('completed');
    expect(component.getFilteredProjects(projects).map((p) => p.id)).toEqual([3]);
    component.statusFilter.set('critical');
    expect(component.getFilteredProjects(projects).map((p) => p.id)).toEqual([2, 3]);
  });

  it('accented "Crítica" sorts first and is matched by the critical filter', () => {
    const list = [proj({ id: 10, prioridad: 'Baja' }), proj({ id: 11, prioridad: 'Crítica' })];
    expect(component.getFilteredProjects(list).map((p) => p.id)).toEqual([11, 10]);
    component.statusFilter.set('critical');
    expect(component.getFilteredProjects(list).map((p) => p.id)).toEqual([11]);
    expect(component.getStats(list).critical).toBe(1);
  });

  it('getStats summarises root projects', () => {
    // "active" excluye Cancelado, igual que el filtro 'active'.
    expect(component.getStats(projects)).toEqual({ total: 6, active: 4, completed: 1, critical: 2 });
    expect(component.getStats([])).toEqual({ total: 0, active: 0, completed: 0, critical: 0 });
  });

  it('open/close modal', () => {
    component.openModal();
    expect(component.showModal()).toBe(true);
    component.closeModal();
    expect(component.showModal()).toBe(false);
  });

  it('reload calls the service and resets isRotating', () => {
    vi.useFakeTimers();
    component.reload();
    expect(service.reload).toHaveBeenCalled();
    expect(component.isRotating()).toBe(true);
    vi.advanceTimersByTime(600);
    expect(component.isRotating()).toBe(false);
  });

  it('handleCreateProject success', () => {
    component.openModal();
    component.handleCreateProject({ nombre: 'Nuevo' });
    expect(service.createProyect).toHaveBeenCalledWith({ nombre: 'Nuevo' });
    expect(component.isSubmitting()).toBe(false);
    expect(component.showModal()).toBe(false);
    expect(service.reload).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Proyecto creado correctamente');
  });

  it('handleCreateProject error', () => {
    service.createProyect.mockReturnValue(throwError(() => ({ error: 'texto plano' })));
    component.openModal();
    component.handleCreateProject({ nombre: 'X' });
    expect(component.isSubmitting()).toBe(false);
    expect(component.showModal()).toBe(true);
    expect(toast.error).toHaveBeenCalledWith('texto plano');
  });
});
