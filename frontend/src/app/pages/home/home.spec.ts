import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, Subject, throwError } from 'rxjs';

import { Home } from './home';
import { TaskService } from '../../services/task.service';
import { ToastService } from '../../services/toast.service';
import { Task } from '../../models/task.model';

function task(over: Partial<Task>): Task {
  return {
    id: 1,
    nombre: 'T',
    descripcion: '',
    comentario: '',
    estado: 'En Curso',
    prioridad: 'normal',
    eliminado: false,
    user_id: 1,
    proyect_id: 1,
    fecha_creacion: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let estadoArg: () => string | null;
  let resource: {
    value: ReturnType<typeof signal<Task[] | undefined>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<unknown>>;
    reload: ReturnType<typeof vi.fn>;
    update: (fn: (v: Task[] | undefined) => Task[] | undefined) => void;
  };
  let taskService: { getAllTasks: ReturnType<typeof vi.fn>; updateTask: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    resource = {
      value: signal<Task[] | undefined>([]),
      isLoading: signal(false),
      error: signal<unknown>(undefined),
      reload: vi.fn(),
      update: (fn) => resource.value.update(fn),
    };
    taskService = {
      getAllTasks: vi.fn((estado: () => string | null) => {
        estadoArg = estado;
        return resource;
      }),
      updateTask: vi.fn().mockReturnValue(of(task({}))),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TaskService, useValue: taskService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('should create with "En Curso" as default filter', () => {
    expect(component).toBeTruthy();
    expect(component.selectedEstado()).toBe('En Curso');
  });

  it('passes the selectedEstado signal to the task resource', () => {
    expect(estadoArg()).toBe('En Curso');
    component.setEstado('Terminado');
    expect(component.selectedEstado()).toBe('Terminado');
    expect(estadoArg()).toBe('Terminado');
  });

  it('sortedTasks orders by prioridad (urgente > alta > normal > baja > unknown)', () => {
    resource.value.set([
      task({ id: 1, prioridad: 'baja' }),
      task({ id: 2, prioridad: 'Urgente' }),
      task({ id: 3, prioridad: 'rara' }),
      task({ id: 4, prioridad: 'normal' }),
      task({ id: 5, prioridad: 'ALTA' }),
    ]);
    expect(component.sortedTasks().map((t) => t.id)).toEqual([2, 5, 4, 1, 3]);
  });

  it('sortedTasks is empty when the resource has no value', () => {
    resource.value.set(undefined);
    expect(component.sortedTasks()).toEqual([]);
  });

  it('reload triggers resource reload and resets isRotating', () => {
    vi.useFakeTimers();
    component.reload();
    expect(resource.reload).toHaveBeenCalled();
    expect(component.isRotating()).toBe(true);
    vi.advanceTimersByTime(600);
    expect(component.isRotating()).toBe(false);
  });

  const estadoOf = (id: number) => resource.value()?.find((t) => t.id === id)?.estado;

  it('sortedTasks tolerates tasks without prioridad', () => {
    resource.value.set([
      task({ id: 1, prioridad: undefined as unknown as string }),
      task({ id: 2, prioridad: 'alta' }),
    ]);
    expect(component.sortedTasks().map((t) => t.id)).toEqual([2, 1]);
  });

  it('toggleTaskComplete marks an open task as Terminado without mutating it', () => {
    const t = task({ id: 7, estado: 'En Curso' });
    resource.value.set([t]);
    component.toggleTaskComplete(t);
    expect(taskService.updateTask).toHaveBeenCalledWith(7, { estado: 'Terminado' });
    expect(estadoOf(7)).toBe('Terminado');
    expect(t.estado).toBe('En Curso');
    expect(toast.success).toHaveBeenCalledWith('Tarea completada');
    expect(resource.reload).toHaveBeenCalled();
  });

  it('toggleTaskComplete updates the list optimistically so computed values react', () => {
    const response = new Subject<Task>();
    taskService.updateTask.mockReturnValue(response);
    const t = task({ id: 7, estado: 'En Curso', prioridad: 'alta' });
    resource.value.set([t]);

    component.toggleTaskComplete(t);

    expect(component.sortedTasks()[0].estado).toBe('Terminado');
    response.next(t);
    response.complete();
  });

  it('toggleTaskComplete reopens a finished task without success toast', () => {
    const t = task({ id: 7, estado: 'Terminado' });
    resource.value.set([t]);
    component.toggleTaskComplete(t);
    expect(taskService.updateTask).toHaveBeenCalledWith(7, { estado: 'Abierto' });
    expect(estadoOf(7)).toBe('Abierto');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('toggleTaskComplete rolls back on error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    taskService.updateTask.mockReturnValue(throwError(() => new Error('x')));
    const t = task({ estado: 'En Curso' });
    resource.value.set([t]);
    component.toggleTaskComplete(t);
    expect(estadoOf(t.id)).toBe('En Curso');
    expect(toast.error).toHaveBeenCalledWith('Error al actualizar tarea');
    expect(resource.reload).not.toHaveBeenCalled();
  });

  it('changeTaskStatus updates estado and reloads', () => {
    const t = task({ id: 3, estado: 'Abierto' });
    resource.value.set([t]);
    component.changeTaskStatus(t, 'Bloqueado');
    expect(taskService.updateTask).toHaveBeenCalledWith(3, { estado: 'Bloqueado' });
    expect(estadoOf(3)).toBe('Bloqueado');
    expect(toast.success).toHaveBeenCalledWith('Tarea: Bloqueado');
    expect(resource.reload).toHaveBeenCalled();
  });

  it('changeTaskStatus rolls back on error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    taskService.updateTask.mockReturnValue(throwError(() => new Error('x')));
    const t = task({ estado: 'Abierto' });
    resource.value.set([t]);
    component.changeTaskStatus(t, 'Bloqueado');
    expect(estadoOf(t.id)).toBe('Abierto');
    expect(toast.error).toHaveBeenCalledWith('Error al cambiar estado');
  });

  it('priority class helpers return strings', () => {
    expect(typeof component.getPriorityBorderClass('alta')).toBe('string');
    expect(typeof component.getPriorityBadgeClass(undefined)).toBe('string');
  });
});
