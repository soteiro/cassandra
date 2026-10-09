import type { Mock } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { TasksTab } from './tasks-tab';
import { Task } from '../../../../models/task.model';
import { TaskService } from '../../../../services/task.service';
import { NotaService } from '../../../../services/nota.service';
import { ToastService } from '../../../../services/toast.service';

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  nombre: 'Tarea',
  descripcion: '',
  comentario: '',
  estado: 'Abierto',
  prioridad: 'normal',
  eliminado: false,
  user_id: 1,
  proyect_id: 7,
  fecha_creacion: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('TasksTab', () => {
  let component: TasksTab;
  let fixture: ComponentFixture<TasksTab>;
  let el: HTMLElement;
  let taskService: {
    updateTask: Mock;
    createTask: Mock;
    deleteTask: Mock;
  };
  let toast: { success: Mock; error: Mock; info: Mock };
  let reloadSpy: Mock<(value?: unknown) => void>;

  beforeEach(async () => {
    taskService = {
      updateTask: vi.fn().mockReturnValue(of({})),
      createTask: vi.fn().mockReturnValue(of({})),
      deleteTask: vi.fn().mockReturnValue(of({})),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [TasksTab],
      providers: [
        provideRouter([]),
        { provide: TaskService, useValue: taskService },
        { provide: NotaService, useValue: { getNotasByTareaId: vi.fn().mockReturnValue(of([])) } },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksTab);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.componentRef.setInput('projectId', 7);
    reloadSpy = vi.fn();
    component.reload.subscribe(reloadSpy);
  });

  afterEach(() => vi.restoreAllMocks());

  const render = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  describe('rendering', () => {
    it('should show the loading state when loading with no tasks', async () => {
      fixture.componentRef.setInput('isLoading', true);
      await render();
      expect(el.textContent).toContain('Cargando');
    });

    it('should render only pending tasks by default', async () => {
      fixture.componentRef.setInput('tareas', [
        makeTask({ id: 1, nombre: 'Pendiente A' }),
        makeTask({ id: 2, nombre: 'Hecha B', estado: 'Terminado' }),
      ]);
      await render();
      expect(el.textContent).toContain('Pendiente A');
      expect(el.textContent).not.toContain('Hecha B');
    });
  });

  describe('filters & sorting', () => {
    const tareas = [
      makeTask({ id: 5, estado: 'Abierto' }),
      makeTask({ id: 4, estado: 'Terminado' }),
      makeTask({ id: 3, estado: 'Bloqueado' }),
      makeTask({ id: 2, estado: 'En Curso' }),
      makeTask({ id: 1, estado: 'Completado' }),
      makeTask({ id: 6, estado: 'Abierto' }),
    ];
    const ids = (list: Task[]) => list.map((t) => t.id);

    it('pending: excludes completed and sorts En Curso > Bloqueado > Abierto, then id', () => {
      expect(ids(component.getFilteredTasks(tareas))).toEqual([2, 3, 5, 6]);
    });

    it('completed: only Terminado/Completado', () => {
      component.taskFilter.set('completed');
      expect(ids(component.getFilteredTasks(tareas))).toEqual([1, 4]);
    });

    it.each([
      ['en_curso', [2]],
      ['bloqueado', [3]],
      ['abierto', [5, 6]],
      ['all', [2, 3, 5, 6, 1, 4]],
    ] as const)('%s filter', (filter, expected) => {
      component.taskFilter.set(filter);
      expect(ids(component.getFilteredTasks(tareas))).toEqual(expected);
    });

    it('should not mutate the input array', () => {
      const copy = [...tareas];
      component.getFilteredTasks(tareas);
      expect(tareas).toEqual(copy);
    });

    it('should sort subtasks by status weight and id', () => {
      const subs = [
        makeTask({ id: 3, estado: 'Terminado' }),
        makeTask({ id: 2, estado: 'Abierto' }),
        makeTask({ id: 1, estado: 'En Curso' }),
      ];
      expect(ids(component.getSortedSubtasks(subs))).toEqual([1, 2, 3]);
      expect(component.getSortedSubtasks(undefined)).toEqual([]);
    });
  });

  describe('stats helpers', () => {
    it('getSubtaskStats should compute completion percent', () => {
      const t = makeTask({
        subtareas: [makeTask({ estado: 'Terminado' }), makeTask(), makeTask()],
      });
      expect(component.getSubtaskStats(t)).toEqual({ total: 3, completed: 1, percent: 33 });
      expect(component.getSubtaskStats(makeTask())).toEqual({ total: 0, completed: 0, percent: 0 });
    });

    it('getOverallStats should count Terminado and Completado', () => {
      const list = [
        makeTask({ estado: 'Terminado' }),
        makeTask({ estado: 'Completado' }),
        makeTask(),
        makeTask(),
      ];
      expect(component.getOverallStats(list)).toEqual({ total: 4, completed: 2, percent: 50 });
      expect(component.getOverallStats([])).toEqual({ total: 0, completed: 0, percent: 0 });
    });

    it('getTaskCountByStatus should be case-insensitive and default to Abierto', () => {
      const list = [makeTask({ estado: '' }), makeTask({ estado: 'abierto' }), makeTask({ estado: 'En Curso' })];
      expect(component.getTaskCountByStatus(list, 'Abierto')).toBe(2);
      expect(component.getTaskCountByStatus(list, 'en curso')).toBe(1);
    });
  });

  describe('expand/collapse', () => {
    it('should toggle and expand tasks', () => {
      component.toggleExpand(1);
      expect(component.isExpanded(1)).toBe(true);
      component.toggleExpand(1);
      expect(component.isExpanded(1)).toBe(false);
      component.expandTask(2);
      component.expandTask(2);
      expect(component.isExpanded(2)).toBe(true);
    });

    it('should toggle expansion from the DOM chevron button', async () => {
      fixture.componentRef.setInput('tareas', [makeTask({ id: 9 })]);
      await render();
      (el.querySelector('button[title="Mostrar subtareas"]') as HTMLButtonElement).click();
      expect(component.isExpanded(9)).toBe(true);
    });
  });

  describe('toggleTaskComplete / toggleSubtaskComplete', () => {
    it('should mark an open task as Terminado, toast and reload', () => {
      const t = makeTask({ estado: 'En Curso' });
      component.toggleTaskComplete(t);
      expect(t.estado).toBe('Terminado');
      expect(taskService.updateTask).toHaveBeenCalledWith(1, { estado: 'Terminado' });
      expect(toast.success).toHaveBeenCalledWith('Tarea Completada');
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should reopen a finished task without the completion toast', () => {
      const t = makeTask({ estado: 'Terminado' });
      component.toggleTaskComplete(t);
      expect(t.estado).toBe('Abierto');
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should revert on error', () => {
      taskService.updateTask.mockReturnValue(throwError(() => new Error('x')));
      const t = makeTask({ estado: 'Abierto' });
      component.toggleTaskComplete(t);
      expect(t.estado).toBe('Abierto');
      expect(toast.error).toHaveBeenCalled();
      expect(reloadSpy).not.toHaveBeenCalled();
    });

    it('should toggle and revert subtasks the same way', () => {
      const sub = makeTask({ id: 3, estado: 'Bloqueado' });
      component.toggleSubtaskComplete(sub);
      expect(sub.estado).toBe('Terminado');
      expect(toast.success).toHaveBeenCalledWith('Tarea Completada');

      taskService.updateTask.mockReturnValue(throwError(() => new Error('x')));
      component.toggleSubtaskComplete(sub);
      expect(sub.estado).toBe('Terminado');
    });
  });

  describe('changeTaskStatus / changeTaskPriority', () => {
    it('should update status and reload', () => {
      const t = makeTask();
      component.changeTaskStatus(t, 'Bloqueado');
      expect(t.estado).toBe('Bloqueado');
      expect(taskService.updateTask).toHaveBeenCalledWith(1, { estado: 'Bloqueado' });
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should revert status on error', () => {
      taskService.updateTask.mockReturnValue(throwError(() => new Error('x')));
      const t = makeTask();
      component.changeTaskStatus(t, 'Bloqueado');
      expect(t.estado).toBe('Abierto');
    });

    it('should update priority and revert on error', () => {
      const t = makeTask();
      component.changeTaskPriority(t, 'urgente');
      expect(t.prioridad).toBe('urgente');
      expect(toast.success).toHaveBeenCalledWith('Prioridad actualizada');

      taskService.updateTask.mockReturnValue(throwError(() => new Error('x')));
      component.changeTaskPriority(t, 'baja');
      expect(t.prioridad).toBe('urgente');
      expect(toast.error).toHaveBeenCalledWith('Error al actualizar prioridad');
    });
  });

  describe('createQuickTask', () => {
    it('should ignore blank titles', () => {
      component.quickTaskTitle.set('   ');
      component.createQuickTask();
      expect(taskService.createTask).not.toHaveBeenCalled();
    });

    it('should create a task with trimmed values and reset the form', () => {
      component.quickTaskTitle.set('  Nueva ');
      component.quickComment.set(' nota ');
      component.quickPriority.set('urgente');
      component.createQuickTask();

      expect(taskService.createTask).toHaveBeenCalledWith({
        nombre: 'Nueva',
        descripcion: '',
        comentario: 'nota',
        estado: 'Abierto',
        prioridad: 'urgente',
        proyect_id: 7,
      });
      expect(component.quickTaskTitle()).toBe('');
      expect(component.quickComment()).toBe('');
      expect(component.quickPriority()).toBe('normal');
      expect(component.isSubmittingQuickTask()).toBe(false);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('«Ya lo hice» la crea terminada', () => {
      component.quickTaskTitle.set('Llamé al banco');
      component.createQuickTask(true);
      expect(taskService.createTask).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Llamé al banco', estado: 'Terminado' }));
      expect(toast.success).toHaveBeenCalledWith('Registrada como hecha');
    });

    it('should keep the title and stop submitting on error', () => {
      taskService.createTask.mockReturnValue(throwError(() => new Error('x')));
      component.quickTaskTitle.set('Nueva');
      component.createQuickTask();
      expect(component.quickTaskTitle()).toBe('Nueva');
      expect(component.isSubmittingQuickTask()).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('createInlineSubtask', () => {
    it('should ignore blank input', () => {
      component.createInlineSubtask(1);
      expect(taskService.createTask).not.toHaveBeenCalled();
    });

    it('should create the subtask, clear input and expand the parent', () => {
      component.setSubtaskInput(4, ' Sub ');
      expect(component.getSubtaskInput(4)).toBe(' Sub ');
      component.createInlineSubtask(4);

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Sub', proyect_id: 7, tarea_padre_id: 4 }),
      );
      expect(component.getSubtaskInput(4)).toBe('');
      expect(component.isSubmittingSubtask()[4]).toBe(false);
      expect(component.isExpanded(4)).toBe(true);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should keep input on error', () => {
      taskService.createTask.mockReturnValue(throwError(() => new Error('x')));
      component.setSubtaskInput(4, 'Sub');
      component.createInlineSubtask(4);
      expect(component.getSubtaskInput(4)).toBe('Sub');
      expect(component.isSubmittingSubtask()[4]).toBe(false);
    });
  });

  describe('delete flow', () => {
    it('should open confirm modal with task info and cancel it', () => {
      component.requestDeleteTask(makeTask({ id: 3, nombre: 'X' }), true);
      expect(component.taskToDelete()).toEqual({ id: 3, nombre: 'X', isSubtask: true });
      component.cancelDeleteTask();
      expect(component.taskToDelete()).toBeNull();
    });

    it('should do nothing on confirm without a target', () => {
      component.confirmDeleteTask();
      expect(taskService.deleteTask).not.toHaveBeenCalled();
    });

    it('should delete the task and reload', () => {
      component.requestDeleteTask(makeTask({ id: 3 }));
      component.confirmDeleteTask();
      expect(taskService.deleteTask).toHaveBeenCalledWith(3);
      expect(component.taskToDelete()).toBeNull();
      expect(component.isDeletingTask()).toBe(false);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should keep the modal open on delete error', () => {
      taskService.deleteTask.mockReturnValue(throwError(() => new Error('x')));
      component.requestDeleteTask(makeTask({ id: 3 }));
      component.confirmDeleteTask();
      expect(component.taskToDelete()).not.toBeNull();
      expect(component.isDeletingTask()).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('edit modal', () => {
    it('should open/close the edit modal and reload on update', () => {
      const t = makeTask();
      component.openEditTask(t);
      expect(component.selectedTask()).toBe(t);
      component.onTaskUpdatedFromModal();
      expect(reloadSpy).toHaveBeenCalled();
      component.closeEditTask();
      expect(component.selectedTask()).toBeNull();
    });
  });
});
