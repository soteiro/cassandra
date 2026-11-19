import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, Subject, throwError } from 'rxjs';

import { Home } from './home';
import { TaskService } from '../../../tareas/data/task.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { Task } from '../../../tareas/data/task.model';
import { ProjectResponse } from '../../../proyectos/data/project.model';
import { ProjectService } from '../../../proyectos/data/project.service';

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
  let taskService: {
    getAllTasks: ReturnType<typeof vi.fn>;
    getTaskById: ReturnType<typeof vi.fn>;
    updateTask: ReturnType<typeof vi.fn>;
  };
  let projects: ReturnType<typeof signal<Pick<ProjectResponse, 'id' | 'nombre'>[]>>;
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
      getTaskById: vi.fn(),
      updateTask: vi.fn().mockReturnValue(of(task({}))),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    projects = signal([]);

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TaskService, useValue: taskService },
        { provide: ToastService, useValue: toast },
        {
          provide: ProjectService,
          useValue: {
            projectsResource: {
              value: projects,
              hasValue: () => true,
              isLoading: signal(false),
              error: signal(undefined),
              reload: vi.fn(),
            },
          },
        },
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

  it('carga los proyectos y filtra las tareas por proyecto y por el estado activo', async () => {
    projects.set([
      { id: 1, nombre: 'Soporte' },
      { id: 2, nombre: 'Archivo' },
      { id: 3, nombre: 'Viajes' },
    ]);
    resource.value.set([
      task({ id: 7, nombre: 'Revisar tickets', proyect_id: 1 }),
      task({ id: 8, nombre: 'Ordenar informes', proyect_id: 2 }),
    ]);
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    const select = root.querySelector<HTMLSelectElement>(
      'select[aria-label="Filtrar por proyecto"]',
    )!;
    const visibles = () =>
      Array.from(root.querySelectorAll('button[title="Editar tarea"]'), (button) =>
        button.textContent?.trim(),
      );
    const seleccionar = async (index: number) => {
      select.selectedIndex = index;
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    };

    expect(Array.from(select.options, (option) => option.text.trim())).toEqual([
      'Todos los proyectos',
      'Archivo',
      'Soporte',
      'Viajes',
    ]);
    expect(visibles()).toEqual(['Revisar tickets', 'Ordenar informes']);

    await seleccionar(1);
    expect(visibles()).toEqual(['Ordenar informes']);
    expect(estadoArg()).toBe('En Curso');

    await seleccionar(3);
    expect(visibles()).toEqual([]);
    expect(root.textContent).toContain('No hay tareas de este proyecto con el estado seleccionado');

    await seleccionar(0);
    expect(visibles()).toEqual(['Revisar tickets', 'Ordenar informes']);
  });

  it('abre el modal desde el listado con las subtareas del detalle, incluso si tienen otro estado', () => {
    const padre = task({ id: 7, nombre: 'Preparar informe' });
    const response = new Subject<Task>();
    resource.value.set([padre]);
    taskService.getTaskById.mockReturnValue(response);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const button = root.querySelector<HTMLButtonElement>('button[title="Editar tarea"]')!;
    button.click();
    fixture.detectChanges();

    expect(taskService.getTaskById).toHaveBeenCalledWith(padre.id);
    expect(component.selectedTask()).toBeNull();
    expect(button.disabled).toBe(true);

    response.next({
      ...padre,
      subtareas: [
        task({ id: 8, nombre: 'Revisar cifras', estado: 'Terminado', tarea_padre_id: 7 }),
      ],
    });
    response.complete();
    fixture.detectChanges();

    expect(root.querySelector('app-task-detail-modal')?.textContent).toContain('Revisar cifras');
    expect(button.disabled).toBe(false);
  });

  it('avisa si el detalle falla y permite reintentar desde la misma tarea', () => {
    const padre = task({ id: 7 });
    resource.value.set([padre]);
    taskService.getTaskById
      .mockReturnValueOnce(throwError(() => new Error('x')))
      .mockReturnValueOnce(of(padre));
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const button = root.querySelector<HTMLButtonElement>('button[title="Editar tarea"]')!;
    button.click();
    expect(toast.error).toHaveBeenCalledWith('No se pudo abrir la tarea');
    expect(component.selectedTask()).toBeNull();

    button.click();
    expect(component.selectedTask()).toEqual(padre);
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

  it('completar una tarea recarga también «Esta semana»', () => {
    fixture.detectChanges();
    const semana = fixture.debugElement.query(
      (d) => d.name === 'app-semana-widget',
    ).componentInstance;
    const recargar = vi.spyOn(semana, 'recargar');
    const t = task({ id: 4, estado: 'En Curso' });
    resource.value.set([t]);
    component.toggleTaskComplete(t);
    expect(recargar).toHaveBeenCalled();
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
