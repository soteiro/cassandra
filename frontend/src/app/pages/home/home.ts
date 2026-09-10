import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TaskService } from '../../services/task.service';
import { ToastService } from '../../services/toast.service';
import { Task } from '../../models/task.model';
import { TaskDetailModal } from '../../components/task-detail-modal/task-detail-modal';
import {
  LucideListTodo,
  LucideRefreshCcw,
  LucideCheck,
} from '@lucide/angular';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TaskDetailModal,
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

  getStatusBadgeClass(estado?: string): string {
    switch (estado) {
      case 'Terminado':
      case 'Completado':
        return 'bg-success/15 text-success border-success/30';
      case 'En Curso':
      case 'En Proceso':
        return 'bg-accent/15 text-accent border-accent/30';
      case 'Bloqueado':
      case 'Pausado':
        return 'bg-danger/15 text-danger border-danger/30';
      default:
        return 'bg-surface-border/50 text-text-muted border-surface-border';
    }
  }

  getPriorityBorderClass(prioridad?: string): string {
    switch (prioridad?.toLowerCase()) {
      case 'urgente':
        return 'border-l-4 border-l-danger';
      case 'alta':
        return 'border-l-4 border-l-amber-500';
      case 'baja':
        return 'border-l-4 border-l-slate-400';
      case 'normal':
      default:
        return 'border-l-4 border-l-accent';
    }
  }

  getPriorityBadgeClass(prioridad?: string): string {
    switch (prioridad?.toLowerCase()) {
      case 'urgente':
        return 'bg-danger/15 text-danger border-danger/30';
      case 'alta':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'baja':
        return 'bg-surface-border/50 text-text-muted border-surface-border';
      case 'normal':
      default:
        return 'bg-accent/15 text-accent border-accent/30';
    }
  }
}
