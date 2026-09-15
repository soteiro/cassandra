import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../../../services/task.service';
import { ToastService } from '../../../../services/toast.service';
import { Task, TaskPrioridad } from '../../../../models/task.model';
import { ConfirmModal } from '../../../../components/confirm-modal/confirm-modal';
import { TaskDetailModal } from '../../../../components/task-detail-modal/task-detail-modal';
import {
  LucideChevronDown,
  LucideChevronRight,
  LucidePlus,
  LucideTrash2,
  LucideCheck,
  LucideListTodo,
  LucideCheckCheck,
  LucideCornerDownRight,
  LucideMessageCircleMore,
} from '@lucide/angular';
import { TaskStatusSelect } from '../../../../components/task-status-select/task-status-select';
import { TaskPrioritySelect } from '../../../../components/task-priority-select/task-priority-select';
import { getTaskPriorityBorderClass } from '../../../../utils/task-styles.util';

@Component({
  selector: 'app-tasks-tab',
  imports: [
    CommonModule,
    FormsModule,
    ConfirmModal,
    TaskDetailModal,
    TaskStatusSelect,
    TaskPrioritySelect,
    LucideChevronDown,
    LucideChevronRight,
    LucidePlus,
    LucideTrash2,
    LucideCheck,
    LucideListTodo,
    LucideCheckCheck,
    LucideCornerDownRight,
    LucideMessageCircleMore,
  ],
  templateUrl: './tasks-tab.html',
})
export class TasksTab {
  projectId = input.required<number>();
  tareas = input<Task[]>([]);
  isLoading = input<boolean>(false);

  reload = output<void>();

  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);

  // State
  selectedTask = signal<Task | null>(null);
  expandedTasks = signal<Set<number>>(new Set());
  quickTaskTitle = signal('');
  quickComment = signal('');
  quickPriority = signal<TaskPrioridad>('normal');
  isSubmittingQuickTask = signal(false);
  quickSubtaskInputs = signal<Record<number, string>>({});
  isSubmittingSubtask = signal<Record<number, boolean>>({});
  taskFilter = signal<'all' | 'pending' | 'completed' | 'en_curso' | 'bloqueado' | 'abierto'>('pending');

  taskToDelete = signal<{ id: number; nombre: string; isSubtask: boolean } | null>(null);
  isDeletingTask = signal(false);

  toggleExpand(taskId: number) {
    const next = new Set(this.expandedTasks());
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    this.expandedTasks.set(next);
  }

  isExpanded(taskId: number): boolean {
    return this.expandedTasks().has(taskId);
  }

  expandTask(taskId: number) {
    if (!this.expandedTasks().has(taskId)) {
      const next = new Set(this.expandedTasks());
      next.add(taskId);
      this.expandedTasks.set(next);
    }
  }

  getSubtaskInput(taskId: number): string {
    return this.quickSubtaskInputs()[taskId] || '';
  }

  setSubtaskInput(taskId: number, value: string) {
    this.quickSubtaskInputs.update((prev) => ({ ...prev, [taskId]: value }));
  }

  // 1-Click Toggle completion on parent task (Optimistic update)
  toggleTaskComplete(task: Task) {
    const prev = task.estado;
    const nextEstado = task.estado === 'Terminado' ? 'Abierto' : 'Terminado';
    task.estado = nextEstado;

    this.taskService.updateTask(task.id, { estado: nextEstado }).subscribe({
      next: () => {
        if (prev === 'Abierto' || prev === 'En Curso' || prev === 'Bloqueado') {
          this.toastService.success('Tarea Completada');
        }
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Ha ocurrido un error');
        task.estado = prev;
        console.error('Error al cambiar estado de tarea:', err);
      },
    });
  }

  // 1-Click Toggle completion on subtask (Optimistic update)
  toggleSubtaskComplete(subtask: Task) {
    const prev = subtask.estado;
    const nextEstado = subtask.estado === 'Terminado' ? 'Abierto' : 'Terminado';
    subtask.estado = nextEstado;

    this.taskService.updateTask(subtask.id, { estado: nextEstado }).subscribe({
      next: () => {
        if (prev === 'Abierto' || prev === 'En Curso' || prev === 'Bloqueado') {
          this.toastService.success('Tarea Completada');
        }
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Ha ocurrido un error');
        subtask.estado = prev;
        console.error('Error al cambiar estado de subtarea:', err);
      },
    });
  }

  changeTaskStatus(task: Task, nextEstado: string) {
    const prev = task.estado;
    task.estado = nextEstado;

    this.taskService.updateTask(task.id, { estado: nextEstado }).subscribe({
      next: () => this.reload.emit(),
      error: (err) => {
        task.estado = prev;
        console.error('Error al actualizar estado de tarea:', err);
      },
    });
  }

  // Create top-level task inline (Zero friction)
  createQuickTask() {
    const title = this.quickTaskTitle().trim();
    const comment = this.quickComment().trim();
    const pId = this.projectId();
    if (!title || !pId) return;

    this.isSubmittingQuickTask.set(true);

    this.taskService
      .createTask({
        nombre: title,
        descripcion: '',
        comentario: comment,
        estado: 'Abierto',
        prioridad: this.quickPriority(),
        proyect_id: pId,
      })
      .subscribe({
        next: () => {
          this.toastService.success('Tarea Creada');
          this.quickTaskTitle.set('');
          this.quickComment.set('');
          this.quickPriority.set('normal');
          this.isSubmittingQuickTask.set(false);
          this.reload.emit();
        },
        error: (err) => {
          this.toastService.error('Ocurrió un error');
          console.error('Error al crear tarea rápida:', err);
          this.isSubmittingQuickTask.set(false);
        },
      });
  }

  // Create subtask inline (Zero friction)
  createInlineSubtask(parentTaskId: number) {
    const title = this.getSubtaskInput(parentTaskId).trim();
    const pId = this.projectId();
    if (!title || !pId) return;

    this.isSubmittingSubtask.update((prev) => ({ ...prev, [parentTaskId]: true }));

    this.taskService
      .createTask({
        nombre: title,
        descripcion: '',
        comentario: '',
        estado: 'Abierto',
        proyect_id: pId,
        tarea_padre_id: parentTaskId,
      })
      .subscribe({
        next: () => {
          this.setSubtaskInput(parentTaskId, '');
          this.isSubmittingSubtask.update((prev) => ({ ...prev, [parentTaskId]: false }));
          this.expandTask(parentTaskId);
          this.toastService.success('Subtarea Creada');
          this.reload.emit();
        },
        error: (err) => {
          this.toastService.error('Ocurrió un error');
          console.error('Error al crear subtarea inline:', err);
          this.isSubmittingSubtask.update((prev) => ({ ...prev, [parentTaskId]: false }));
        },
      });
  }

  // Modal Deletion Flow for Tasks
  requestDeleteTask(task: Task, isSubtask = false) {
    this.taskToDelete.set({ id: task.id, nombre: task.nombre, isSubtask });
  }

  confirmDeleteTask() {
    const target = this.taskToDelete();
    if (!target) return;

    this.isDeletingTask.set(true);
    this.taskService.deleteTask(target.id).subscribe({
      next: () => {
        this.isDeletingTask.set(false);
        this.taskToDelete.set(null);
        this.toastService.success('Tarea Eliminada');
        this.reload.emit();
      },
      error: (err) => {
        this.isDeletingTask.set(false);
        this.toastService.error('Ocurrió un error');
        console.error('Error al eliminar tarea:', err);
      },
    });
  }

  cancelDeleteTask() {
    this.taskToDelete.set(null);
  }

  // Helper metrics
  getSubtaskStats(task: Task) {
    const subs = task.subtareas || [];
    const total = subs.length;
    const completed = subs.filter((s) => s.estado === 'Terminado').length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percent };
  }

  getTaskCountByStatus(tareas: Task[], status: string): number {
    if (!tareas) return 0;
    return tareas.filter((t) => (t.estado || 'Abierto').toLowerCase() === status.toLowerCase()).length;
  }

  private getTaskStatusWeight(estado?: string): number {
    switch (estado?.trim()) {
      case 'En Curso':
        return 1;
      case 'Bloqueado':
        return 2;
      case 'Abierto':
        return 3;
      case 'Terminado':
      case 'Completado':
        return 4;
      default:
        return 5;
    }
  }

  getFilteredTasks(tareas: Task[]): Task[] {
    const filter = this.taskFilter();
    let filtered = tareas || [];

    if (filter === 'pending') {
      filtered = filtered.filter((t) => t.estado !== 'Terminado' && t.estado !== 'Completado');
    } else if (filter === 'completed') {
      filtered = filtered.filter((t) => t.estado === 'Terminado' || t.estado === 'Completado');
    } else if (filter === 'en_curso') {
      filtered = filtered.filter((t) => (t.estado || '').toLowerCase() === 'en curso');
    } else if (filter === 'bloqueado') {
      filtered = filtered.filter((t) => (t.estado || '').toLowerCase() === 'bloqueado');
    } else if (filter === 'abierto') {
      filtered = filtered.filter((t) => (t.estado || 'Abierto').toLowerCase() === 'abierto');
    }

    return [...filtered].sort((a, b) => {
      const weightA = this.getTaskStatusWeight(a.estado);
      const weightB = this.getTaskStatusWeight(b.estado);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.id - b.id;
    });
  }

  getSortedSubtasks(subtareas?: Task[]): Task[] {
    if (!subtareas || subtareas.length === 0) return [];
    return [...subtareas].sort((a, b) => {
      const weightA = this.getTaskStatusWeight(a.estado);
      const weightB = this.getTaskStatusWeight(b.estado);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.id - b.id;
    });
  }

  getOverallStats(tareas: Task[]) {
    if (!tareas || tareas.length === 0) return { total: 0, completed: 0, percent: 0 };
    const total = tareas.length;
    const completed = tareas.filter((t) => t.estado === 'Terminado' || t.estado === 'Completado').length;
    const percent = Math.round((completed / total) * 100);
    return { total, completed, percent };
  }

  changeTaskPriority(task: Task, nextPrioridad: string) {
    const prev = task.prioridad;
    task.prioridad = nextPrioridad;

    this.taskService.updateTask(task.id, { prioridad: nextPrioridad }).subscribe({
      next: () => {
        this.toastService.success('Prioridad actualizada');
        this.reload.emit();
      },
      error: (err) => {
        task.prioridad = prev;
        this.toastService.error('Error al actualizar prioridad');
        console.error('Error al actualizar prioridad:', err);
      },
    });
  }

  getPriorityBorderClass(prioridad?: string, isSubtask = false): string {
    return getTaskPriorityBorderClass(prioridad, isSubtask);
  }

  openEditTask(task: Task) {
    this.selectedTask.set(task);
  }

  closeEditTask() {
    this.selectedTask.set(null);
  }

  onTaskUpdatedFromModal() {
    this.reload.emit();
  }
}
