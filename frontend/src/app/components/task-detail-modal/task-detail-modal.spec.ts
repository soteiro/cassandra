import type { Mock } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { TaskDetailModal } from './task-detail-modal';
import { Task } from '../../models/task.model';
import { NotaProyecto } from '../../models/nota.model';
import { TaskService } from '../../services/task.service';
import { NotaService } from '../../services/nota.service';
import { ToastService } from '../../services/toast.service';

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  nombre: 'Tarea 1',
  descripcion: 'desc',
  comentario: 'com',
  estado: 'En Curso',
  prioridad: 'alta',
  eliminado: false,
  user_id: 1,
  proyect_id: 3,
  fecha_creacion: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeNota = (overrides: Partial<NotaProyecto> = {}): NotaProyecto => ({
  id: 100,
  proyecto_id: 3,
  user_id: 1,
  tarea_id: 1,
  nota: 'Nota existente',
  fecha_creacion: '2026-01-01T00:00:00Z',
  eliminado: false,
  ...overrides,
});

describe('TaskDetailModal', () => {
  let component: TaskDetailModal;
  let fixture: ComponentFixture<TaskDetailModal>;
  let el: HTMLElement;
  let taskService: {
    updateTask: ReturnType<typeof vi.fn>;
    deleteTask: ReturnType<typeof vi.fn>;
    createTask: ReturnType<typeof vi.fn>;
  };
  let notaService: {
    getNotasByTareaId: ReturnType<typeof vi.fn>;
    createNota: ReturnType<typeof vi.fn>;
    deleteNota: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let updatedSpy: Mock<(value?: unknown) => void>;
  let deletedSpy: Mock<(value?: unknown) => void>;
  let closeSpy: Mock<(value?: unknown) => void>;

  const open = (task: Task) => {
    fixture.componentRef.setInput('task', task);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    taskService = {
      updateTask: vi.fn().mockReturnValue(of({})),
      deleteTask: vi.fn().mockReturnValue(of({})),
      createTask: vi.fn(),
    };
    notaService = {
      getNotasByTareaId: vi.fn().mockReturnValue(of([makeNota()])),
      createNota: vi.fn(),
      deleteNota: vi.fn().mockReturnValue(of({})),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [TaskDetailModal],
      providers: [
        provideRouter([]),
        { provide: TaskService, useValue: taskService },
        { provide: NotaService, useValue: notaService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDetailModal);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.componentRef.setInput('proyectId', 3);
    updatedSpy = vi.fn();
    deletedSpy = vi.fn();
    closeSpy = vi.fn();
    component.taskUpdated.subscribe(updatedSpy);
    component.taskDeleted.subscribe(deletedSpy);
    component.closeModal.subscribe(closeSpy);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should not render while closed', () => {
    expect(component.shouldRender()).toBe(false);
    expect(el.querySelector('form')).toBeNull();
  });

  it('should populate the form, load notes and animate in when opened', () => {
    open(makeTask());
    expect(component.shouldRender()).toBe(true);
    expect(component.isVisible()).toBe(false);
    expect(component.nombre()).toBe('Tarea 1');
    expect(component.estado()).toBe('En Curso');
    expect(component.prioridad()).toBe('alta');
    expect(notaService.getNotasByTareaId).toHaveBeenCalledWith(1);
    expect(component.taskNotas().length).toBe(1);

    vi.advanceTimersByTime(25);
    expect(component.isVisible()).toBe(true);
    fixture.detectChanges();
    expect(el.querySelector('form')).toBeTruthy();
    expect(el.textContent).toContain('Nota existente');
  });

  it('should default estado/prioridad when task has none', () => {
    open(makeTask({ estado: '', prioridad: '' }));
    expect(component.estado()).toBe('Abierto');
    expect(component.prioridad()).toBe('normal');
  });

  it('should compute subtask progress', () => {
    open(
      makeTask({
        subtareas: [
          makeTask({ id: 2, estado: 'Terminado' }),
          makeTask({ id: 3, estado: 'Abierto' }),
          makeTask({ id: 4, estado: 'Terminado' }),
        ],
      }),
    );
    expect(component.totalSubtareas()).toBe(3);
    expect(component.completadasCount()).toBe(2);
    expect(component.porcentajeProgreso()).toBe(67);
  });

  it('should report 0% progress with no subtasks', () => {
    open(makeTask());
    expect(component.porcentajeProgreso()).toBe(0);
  });

  it('should stop rendering after the close animation when isOpen becomes false', () => {
    open(makeTask());
    vi.advanceTimersByTime(25);
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    expect(component.isVisible()).toBe(false);
    expect(component.shouldRender()).toBe(true);
    vi.advanceTimersByTime(300);
    expect(component.shouldRender()).toBe(false);
  });

  it('should emit closeModal after the animation on onClose', () => {
    open(makeTask());
    component.onClose();
    expect(closeSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(component.shouldRender()).toBe(false);
  });

  it('should close on Escape when open', () => {
    open(makeTask());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(300);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('should ignore Escape when closed', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(300);
    expect(closeSpy).not.toHaveBeenCalled();
  });

  describe('saveTask', () => {
    it('should reject an empty name', () => {
      open(makeTask());
      component.nombre.set('   ');
      component.saveTask();
      expect(toast.error).toHaveBeenCalledWith('El nombre de la tarea no puede estar vacío');
      expect(taskService.updateTask).not.toHaveBeenCalled();
    });

    it('should update the task, mutate it locally, emit and close', () => {
      const task = makeTask();
      open(task);
      component.nombre.set('  Renombrada ');
      component.estado.set('Terminado');
      component.saveTask();

      expect(taskService.updateTask).toHaveBeenCalledWith(1, {
        nombre: 'Renombrada',
        descripcion: 'desc',
        comentario: 'com',
        estado: 'Terminado',
        prioridad: 'alta',
      });
      expect(task.nombre).toBe('Renombrada');
      expect(task.estado).toBe('Terminado');
      expect(component.isSaving()).toBe(false);
      expect(toast.success).toHaveBeenCalled();
      expect(updatedSpy).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(300);
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should show an error and keep the modal open on failure', () => {
      taskService.updateTask.mockReturnValue(throwError(() => new Error('x')));
      open(makeTask());
      component.saveTask();
      expect(toast.error).toHaveBeenCalledWith('Error al guardar la tarea');
      expect(component.isSaving()).toBe(false);
      expect(updatedSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteCurrentTask', () => {
    it('should do nothing if the user cancels the confirm', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      open(makeTask());
      component.deleteCurrentTask();
      expect(taskService.deleteTask).not.toHaveBeenCalled();
    });

    it('should delete, emit taskDeleted/taskUpdated and close', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      open(makeTask({ id: 9 }));
      component.deleteCurrentTask();
      expect(taskService.deleteTask).toHaveBeenCalledWith(9);
      expect(deletedSpy).toHaveBeenCalledWith(9);
      expect(updatedSpy).toHaveBeenCalled();
      vi.advanceTimersByTime(300);
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should toast on delete error', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      taskService.deleteTask.mockReturnValue(throwError(() => new Error('x')));
      open(makeTask());
      component.deleteCurrentTask();
      expect(toast.error).toHaveBeenCalledWith('Error al eliminar tarea');
      expect(component.isDeleting()).toBe(false);
      expect(deletedSpy).not.toHaveBeenCalled();
    });
  });

  describe('subtareas', () => {
    it('should ignore blank subtask names', () => {
      open(makeTask());
      component.nuevaSubtareaNombre.set('  ');
      component.addSubtarea();
      expect(taskService.createTask).not.toHaveBeenCalled();
    });

    it('should create a subtask and append it to the task', () => {
      const task = makeTask({ id: 5 });
      const created = makeTask({ id: 50, nombre: 'Sub', tarea_padre_id: 5 });
      taskService.createTask.mockReturnValue(of(created));
      open(task);
      component.nuevaSubtareaNombre.set(' Sub ');
      component.addSubtarea();

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Sub', proyect_id: 3, tarea_padre_id: 5, prioridad: 'normal' }),
      );
      expect(component.subtareas()).toEqual([created]);
      expect(component.totalSubtareas()).toBe(1);
      expect(component.nuevaSubtareaNombre()).toBe('');
      expect(updatedSpy).toHaveBeenCalled();
    });

    it('should toast when subtask creation fails', () => {
      taskService.createTask.mockReturnValue(throwError(() => new Error('x')));
      open(makeTask());
      component.nuevaSubtareaNombre.set('Sub');
      component.addSubtarea();
      expect(toast.error).toHaveBeenCalledWith('Error al crear subtarea');
      expect(component.isSubmittingSubtarea()).toBe(false);
    });

    it('should toggle subtask status optimistically and update the progress', () => {
      open(makeTask({ subtareas: [makeTask({ id: 2, estado: 'Abierto' })] }));
      const sub = () => component.subtareas()[0];

      component.toggleSubtareaStatus(sub());
      expect(sub().estado).toBe('Terminado');
      expect(component.completadasCount()).toBe(1);
      expect(taskService.updateTask).toHaveBeenCalledWith(2, { estado: 'Terminado' });

      component.toggleSubtareaStatus(sub());
      expect(sub().estado).toBe('Abierto');
      expect(component.completadasCount()).toBe(0);
      expect(updatedSpy).toHaveBeenCalledTimes(2);
    });

    it('should revert the subtask status and toast when the update fails', () => {
      taskService.updateTask.mockReturnValue(throwError(() => new Error('x')));
      open(makeTask({ subtareas: [makeTask({ id: 2, estado: 'Abierto' })] }));

      component.toggleSubtareaStatus(component.subtareas()[0]);

      expect(component.subtareas()[0].estado).toBe('Abierto');
      expect(toast.error).toHaveBeenCalledWith('Error al cambiar estado de subtarea');
      expect(updatedSpy).not.toHaveBeenCalled();
    });

    it('should delete a subtask after confirm and remove it from the list', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const task = makeTask({ subtareas: [makeTask({ id: 2 }), makeTask({ id: 3 })] });
      open(task);
      component.deleteSubtarea(2);
      expect(taskService.deleteTask).toHaveBeenCalledWith(2);
      expect(component.subtareas().map((s) => s.id)).toEqual([3]);
      expect(component.totalSubtareas()).toBe(1);
      expect(updatedSpy).toHaveBeenCalled();
    });

    it('should not delete a subtask if confirm is cancelled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      open(makeTask());
      component.deleteSubtarea(2);
      expect(taskService.deleteTask).not.toHaveBeenCalled();
    });
  });

  describe('notas', () => {
    it('should keep an empty list if loading notes fails', () => {
      notaService.getNotasByTareaId.mockReturnValue(throwError(() => new Error('x')));
      open(makeTask());
      expect(component.taskNotas()).toEqual([]);
      expect(component.isLoadingNotas()).toBe(false);
    });

    it('should not create an empty note', () => {
      open(makeTask());
      component.newNotaTexto.set('   ');
      component.addTaskNota();
      expect(notaService.createNota).not.toHaveBeenCalled();
    });

    it('should create a note and prepend it', () => {
      const nueva = makeNota({ id: 101, nota: 'Nueva' });
      notaService.createNota.mockReturnValue(of(nueva));
      open(makeTask());
      component.newNotaTexto.set(' Nueva ');
      component.addTaskNota();
      expect(notaService.createNota).toHaveBeenCalledWith(3, { nota: 'Nueva', tarea_id: 1 });
      expect(component.taskNotas().map((n) => n.id)).toEqual([101, 100]);
      expect(component.newNotaTexto()).toBe('');
      expect(updatedSpy).toHaveBeenCalled();
    });

    it('should toast if creating a note fails', () => {
      notaService.createNota.mockReturnValue(throwError(() => new Error('x')));
      open(makeTask());
      component.newNotaTexto.set('x');
      component.addTaskNota();
      expect(toast.error).toHaveBeenCalledWith('Error al guardar nota');
      expect(component.isSavingNota()).toBe(false);
    });

    it('should delete a note after confirm', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      open(makeTask());
      component.deleteTaskNota(100);
      expect(notaService.deleteNota).toHaveBeenCalledWith(100);
      expect(component.taskNotas()).toEqual([]);
    });

    it('should copy note content and reset the copied flag after 2s', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      open(makeTask());
      component.copyNotaContent(makeNota());
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith('Nota existente');
      expect(component.copiedNotaId()).toBe(100);
      vi.advanceTimersByTime(2000);
      expect(component.copiedNotaId()).toBeNull();
    });
  });
});
