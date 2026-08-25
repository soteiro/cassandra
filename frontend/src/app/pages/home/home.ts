import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TaskService } from '../../services/task.service';
import { ToastService } from '../../services/toast.service';
import { Task } from '../../models/task.model';
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
}
