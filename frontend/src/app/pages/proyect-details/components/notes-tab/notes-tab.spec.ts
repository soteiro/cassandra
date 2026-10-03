import type { Mock } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { NotesTab } from './notes-tab';
import { NotaProyecto } from '../../../../models/nota.model';
import { Task } from '../../../../models/task.model';
import { NotaService } from '../../../../services/nota.service';
import { TaskService } from '../../../../services/task.service';
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

const makeNota = (overrides: Partial<NotaProyecto> = {}): NotaProyecto => ({
  id: 1,
  proyecto_id: 7,
  user_id: 1,
  tarea_id: null,
  nota: 'Nota',
  fecha_creacion: '2026-01-01T00:00:00Z',
  eliminado: false,
  ...overrides,
});

describe('NotesTab', () => {
  let component: NotesTab;
  let fixture: ComponentFixture<NotesTab>;
  let el: HTMLElement;
  let notaService: {
    createNota: Mock;
    updateNota: Mock;
    deleteNota: Mock;
    getNotasByTareaId: Mock;
  };
  let taskService: { getTaskById: Mock };
  let toast: { success: Mock; error: Mock; info: Mock };
  let reloadSpy: Mock<(value?: unknown) => void>;

  beforeEach(async () => {
    notaService = {
      createNota: vi.fn().mockReturnValue(of({})),
      updateNota: vi.fn().mockReturnValue(of({})),
      deleteNota: vi.fn().mockReturnValue(of({})),
      getNotasByTareaId: vi.fn().mockReturnValue(of([])),
    };
    taskService = { getTaskById: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [NotesTab],
      providers: [
        provideRouter([]),
        { provide: NotaService, useValue: notaService },
        { provide: TaskService, useValue: taskService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotesTab);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.componentRef.setInput('projectId', 7);
    reloadSpy = vi.fn();
    component.reload.subscribe(reloadSpy);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  describe('rendering', () => {
    it('should show loading state', async () => {
      fixture.componentRef.setInput('isLoading', true);
      await render();
      expect(el.textContent).toContain('Cargando notas del proyecto...');
    });

    it('should show empty state with no notes', async () => {
      await render();
      expect(el.textContent).toContain('No hay notas registradas');
      expect(el.querySelector('input[placeholder="Buscar en notas..."]')).toBeNull();
    });

    it('should render notes and the search box', async () => {
      fixture.componentRef.setInput('notas', [makeNota({ nota: 'Primera' }), makeNota({ id: 2, nota: 'Segunda' })]);
      await render();
      expect(el.textContent).toContain('Primera');
      expect(el.textContent).toContain('Segunda');
      expect(el.querySelector('input[placeholder="Buscar en notas..."]')).toBeTruthy();
    });

    it('should show "no results" when the filter matches nothing', async () => {
      fixture.componentRef.setInput('notas', [makeNota({ nota: 'Primera' })]);
      component.notaSearchQuery.set('zzz');
      await render();
      expect(el.textContent).toContain('No se encontraron notas con el filtro seleccionado.');
    });
  });

  describe('filtering', () => {
    const notas = [
      makeNota({ id: 1, nota: 'General Docker' }),
      makeNota({ id: 2, nota: 'Ligada', tarea_id: 5, tarea_nombre: 'Deploy Docker' }),
      makeNota({ id: 3, nota: 'Otra', tarea_id: 6, tarea_nombre: 'Frontend' }),
    ];
    const ids = (list: NotaProyecto[]) => list.map((n) => n.id);

    it('should filter by type', () => {
      expect(ids(component.getFilteredNotas(notas))).toEqual([1, 2, 3]);
      component.filterTipo.set('generales');
      expect(ids(component.getFilteredNotas(notas))).toEqual([1]);
      component.filterTipo.set('tareas');
      expect(ids(component.getFilteredNotas(notas))).toEqual([2, 3]);
    });

    it('should search in note text and linked task name, case-insensitively', () => {
      component.notaSearchQuery.set('  DOCKER ');
      expect(ids(component.getFilteredNotas(notas))).toEqual([1, 2]);
      component.notaSearchQuery.set('frontend');
      expect(ids(component.getFilteredNotas(notas))).toEqual([3]);
    });

    it('should count general and task notes', () => {
      fixture.componentRef.setInput('notas', notas);
      expect(component.getGeneralesCount()).toBe(1);
      expect(component.getTareasCount()).toBe(2);
    });
  });

  describe('task linking', () => {
    const tareas = [
      makeTask({ id: 1, nombre: 'A', estado: 'En Curso' }),
      makeTask({ id: 2, nombre: 'B', estado: 'Abierto' }),
      makeTask({ id: 3, nombre: 'C', estado: 'En Curso' }),
    ];

    beforeEach(() => fixture.componentRef.setInput('tareas', tareas));

    it('tareasEnCurso should only include En Curso tasks', () => {
      expect(component.tareasEnCurso().map((t) => t.id)).toEqual([1, 3]);
    });

    it('getLinkableTasks should also include the currently selected task', () => {
      expect(component.getLinkableTasks().map((t) => t.id)).toEqual([1, 3]);
      expect(component.getLinkableTasks(2).map((t) => t.id)).toEqual([1, 2, 3]);
    });

    it('getTaskNombre should resolve names', () => {
      expect(component.getTaskNombre(2)).toBe('B');
      expect(component.getTaskNombre(99)).toBe('');
      expect(component.getTaskNombre(null)).toBe('');
    });
  });

  describe('createNota', () => {
    it('should ignore blank text', () => {
      component.newNotaText.set('  ');
      component.createNota();
      expect(notaService.createNota).not.toHaveBeenCalled();
    });

    it('should create a general note (no task) and reset the form', () => {
      component.newNotaText.set(' Hola ');
      component.createNota();
      expect(notaService.createNota).toHaveBeenCalledWith(7, { nota: 'Hola', tarea_id: undefined });
      expect(component.newNotaText()).toBe('');
      expect(component.isSubmittingNota()).toBe(false);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should link the note to a task when selected', () => {
      component.newNotaText.set('Hola');
      component.newNotaTareaId.set(3);
      component.createNota();
      expect(notaService.createNota).toHaveBeenCalledWith(7, { nota: 'Hola', tarea_id: 3 });
      expect(component.newNotaTareaId()).toBeNull();
    });

    it('should keep text on error', () => {
      notaService.createNota.mockReturnValue(throwError(() => new Error('x')));
      component.newNotaText.set('Hola');
      component.createNota();
      expect(component.newNotaText()).toBe('Hola');
      expect(component.isSubmittingNota()).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Error al guardar la nota');
    });
  });

  describe('editing', () => {
    it('should start and cancel editing', () => {
      component.startEditNota(makeNota({ id: 4, nota: 'Texto', tarea_id: 2 }));
      expect(component.editingNotaId()).toBe(4);
      expect(component.editingNotaText()).toBe('Texto');
      expect(component.editingNotaTareaId()).toBe(2);
      component.cancelEditNota();
      expect(component.editingNotaId()).toBeNull();
      expect(component.editingNotaText()).toBe('');
      expect(component.editingNotaTareaId()).toBeNull();
    });

    it('should reject empty text on save', () => {
      const nota = makeNota();
      component.startEditNota(nota);
      component.editingNotaText.set('  ');
      component.saveEditNota(nota);
      expect(toast.error).toHaveBeenCalledWith('La nota no puede estar vacía');
      expect(notaService.updateNota).not.toHaveBeenCalled();
    });

    it('should send clear_tarea_id when unlinking the task', () => {
      const nota = makeNota({ id: 4, tarea_id: 2 });
      component.startEditNota(nota);
      component.editingNotaTareaId.set(null);
      component.editingNotaText.set(' Editada ');
      component.saveEditNota(nota);
      expect(notaService.updateNota).toHaveBeenCalledWith(4, {
        nota: 'Editada',
        tarea_id: null,
        clear_tarea_id: true,
      });
      expect(component.editingNotaId()).toBeNull();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should keep the task link when present', () => {
      const nota = makeNota({ id: 4, tarea_id: 2 });
      component.startEditNota(nota);
      component.saveEditNota(nota);
      expect(notaService.updateNota).toHaveBeenCalledWith(4, {
        nota: 'Nota',
        tarea_id: 2,
        clear_tarea_id: false,
      });
    });

    it('should stay in edit mode on update error', () => {
      notaService.updateNota.mockReturnValue(throwError(() => new Error('x')));
      const nota = makeNota({ id: 4 });
      component.startEditNota(nota);
      component.saveEditNota(nota);
      expect(component.editingNotaId()).toBe(4);
      expect(component.isUpdatingNota()).toBe(false);
    });
  });

  describe('delete flow', () => {
    it('should open and cancel delete modal', () => {
      const nota = makeNota();
      component.openDeleteNotaModal(nota);
      expect(component.notaToDelete()).toBe(nota);
      component.cancelDeleteNota();
      expect(component.notaToDelete()).toBeNull();
    });

    it('should do nothing on confirm without target', () => {
      component.confirmDeleteNota();
      expect(notaService.deleteNota).not.toHaveBeenCalled();
    });

    it('should delete and reload', () => {
      component.openDeleteNotaModal(makeNota({ id: 8 }));
      component.confirmDeleteNota();
      expect(notaService.deleteNota).toHaveBeenCalledWith(8);
      expect(component.notaToDelete()).toBeNull();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should keep modal open on error', () => {
      notaService.deleteNota.mockReturnValue(throwError(() => new Error('x')));
      component.openDeleteNotaModal(makeNota({ id: 8 }));
      component.confirmDeleteNota();
      expect(component.notaToDelete()).not.toBeNull();
      expect(component.isDeletingNota()).toBe(false);
    });
  });

  describe('openTaskModal', () => {
    it('should ignore empty ids', () => {
      component.openTaskModal(null);
      expect(component.selectedTask()).toBeNull();
      expect(taskService.getTaskById).not.toHaveBeenCalled();
    });

    it('should find top-level tasks and subtasks locally', () => {
      const sub = makeTask({ id: 20 });
      const parent = makeTask({ id: 2, subtareas: [sub] });
      fixture.componentRef.setInput('tareas', [parent]);
      component.openTaskModal(2);
      expect(component.selectedTask()).toBe(parent);
      component.openTaskModal(20);
      expect(component.selectedTask()).toBe(sub);
      expect(taskService.getTaskById).not.toHaveBeenCalled();
    });

    it('should fall back to the API when the task is not loaded', () => {
      const remote = makeTask({ id: 99 });
      taskService.getTaskById.mockReturnValue(of(remote));
      component.openTaskModal(99);
      expect(taskService.getTaskById).toHaveBeenCalledWith(99);
      expect(component.selectedTask()).toBe(remote);
    });

    it('should toast if the API fallback fails', () => {
      taskService.getTaskById.mockReturnValue(throwError(() => new Error('x')));
      component.openTaskModal(99);
      expect(toast.error).toHaveBeenCalledWith('No se pudo cargar la tarea vinculada');
      expect(component.selectedTask()).toBeNull();
    });

    it('should clear the selection and reload when the task is deleted from the modal', () => {
      component.selectedTask.set(makeTask());
      component.onTaskModalDeleted(1);
      expect(component.selectedTask()).toBeNull();
      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  it('should copy note content and clear the flag after 2s', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    component.copyNotaContent(makeNota({ id: 5, nota: 'copiar' }));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('copiar');
    expect(component.copiedNotaId()).toBe(5);
    expect(toast.success).toHaveBeenCalledWith('Nota copiada al portapapeles');
    vi.advanceTimersByTime(2000);
    expect(component.copiedNotaId()).toBeNull();
  });
});
