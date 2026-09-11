import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TaskService } from '../../services/task.service';
import { ToastService } from '../../services/toast.service';
import { Task } from '../../models/task.model';
import { TaskDetailModal } from '../../components/task-detail-modal/task-detail-modal';
import { TaskStatusSelect } from '../../components/task-status-select/task-status-select';
import {
  getTaskPriorityBadgeClass,
  getTaskPriorityBorderClass,
} from '../../utils/task-styles.util';
import { LucideListTodo, LucideRefreshCcw, LucideCheck } from '@lucide/angular';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TaskDetailModal,
    TaskStatusSelect,
    LucideListTodo,
    LucideRefreshCcw,
    LucideCheck,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})

export class Home {
  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);
  readonly sortedTasks = computed(() => {
  const tasks = this.tasksResource?.value() ?? [];
  const priorityOrder = { urgente: 0, alta: 1, normal: 2, baja: 3 };

  return [...tasks].sort(
    (a, b) =>
      (priorityOrder[a.prioridad.toLowerCase() as keyof typeof priorityOrder] ?? 99) -
      (priorityOrder[b.prioridad.toLowerCase() as keyof typeof priorityOrder] ?? 99)
  );
});
  // Selected task for right-drawer modal
  selectedTask = signal<Task | null>(null);

  // Filter state: 'En Curso' by default
  selectedEstado = signal<string>('En Curso');
  isRotating = signal<boolean>(false);

  // Task resource
  protected readonly tasksResource = this.taskService.getAllTasks(this.selectedEstado);

  reload() {
    this.isRotating.set(true);
    this.tasksResource?.reload();
    setTimeout(() => this.isRotating.set(false), 600);
  }

  setEstado(estado: string) {
    this.selectedEstado.set(estado);
  }

  toggleTaskComplete(task: Task) {
    const prev = task.estado;
    const nextEstado = task.estado === 'Terminado' ? 'Abierto' : 'Terminado';
    task.estado = nextEstado;

    this.taskService.updateTask(task.id, { estado: nextEstado }).subscribe({
      next: () => {
        if (nextEstado === 'Terminado') {
          this.toastService.success('Tarea completada');
        }
        this.tasksResource?.reload();
      },
      error: (err) => {
        task.estado = prev;
        this.toastService.error('Error al actualizar tarea');
        console.error('Error:', err);
      },
    });
  }

  changeTaskStatus(task: Task, nextEstado: string) {
    const prev = task.estado;
    task.estado = nextEstado;

    this.taskService.updateTask(task.id, { estado: nextEstado }).subscribe({
      next: () => {
        this.toastService.success(`Tarea: ${nextEstado}`);
        this.tasksResource?.reload();
      },
      error: (err) => {
        task.estado = prev;
        this.toastService.error('Error al cambiar estado');
        console.error('Error:', err);
      },
    });
  }

  getPriorityBorderClass(prioridad?: string): string {
    return getTaskPriorityBorderClass(prioridad);
  }

  getPriorityBadgeClass(prioridad?: string): string {
    return getTaskPriorityBadgeClass(prioridad);
  }
}
