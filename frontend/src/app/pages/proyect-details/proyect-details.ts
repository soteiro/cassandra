import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { proyectService } from '../../services/proyect.service';
import { TaskService } from '../../services/task.service';
import { Task } from '../../models/task.model';
import { TaskDetailModal } from '../../components/task-detail-modal/task-detail-modal';

@Component({
  selector: 'app-proyect-details',
  imports: [CommonModule, FormsModule, RouterLink, TaskDetailModal],
  templateUrl: './proyect-details.html',
  styleUrl: './proyect-details.css',
})
export class ProyectDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly ProyectService = inject(proyectService);
  private readonly taskService = inject(TaskService);

  private readonly id = () => this.route.snapshot.paramMap.get('id');
  protected readonly projectIdNumber = () => Number(this.id());

  protected readonly projectResource = this.ProyectService.getProyectById(this.id);
  protected readonly tasksResource = this.taskService.getTasksByProyectoId(this.id);

  // Modal de detalle visual de Tarea y sus subtareas
  selectedTaskForDetail = signal<Task | null>(null);

  // Modal y formulario de creación de Tareas
  showTaskModal = signal(false);
  tareaPadreId = signal<number | null>(null);
  tareaPadreNombre = signal<string>('');
  nombreTarea = signal('');
  descripcionTarea = signal('');
  comentarioTarea = signal('');
  estadoTarea = signal('Abierto');

  isSubmittingTask = signal(false);
  taskErrorMessage = signal('');

  openTaskDetail(task: Task) {
    this.selectedTaskForDetail.set(task);
  }

  closeTaskDetail() {
    this.selectedTaskForDetail.set(null);
  }

  onTaskUpdated() {
    this.tasksResource?.reload();
    const currentSelected = this.selectedTaskForDetail();
    if (currentSelected) {
      this.taskService.getTaskById(currentSelected.id).subscribe({
        next: (updatedTask) => this.selectedTaskForDetail.set(updatedTask),
        error: (err) => console.error('Error al recargar tarea:', err),
      });
    }
  }

  openTaskModal(parentTask?: Task) {
    this.taskErrorMessage.set('');
    if (parentTask) {
      this.tareaPadreId.set(parentTask.id);
      this.tareaPadreNombre.set(parentTask.nombre);
    } else {
      this.tareaPadreId.set(null);
      this.tareaPadreNombre.set('');
    }
    this.showTaskModal.set(true);
  }

  closeTaskModal() {
    this.showTaskModal.set(false);
    this.tareaPadreId.set(null);
    this.tareaPadreNombre.set('');
  }

  getPriorityClass(priority?: string): string {
    switch (priority) {
      case 'Critica':
        return 'bg-red-900/40 text-red-400 border border-red-800';
      case 'Alta':
        return 'bg-orange-900/40 text-orange-400 border border-orange-800';
      case 'Media':
        return 'bg-amber-900/40 text-amber-400 border border-amber-800';
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  }

  getTaskStatusClass(estado?: string): string {
    switch (estado) {
      case 'Terminado':
        return 'bg-emerald-900/40 text-emerald-400 border border-emerald-800';
      case 'En Curso':
        return 'bg-blue-900/40 text-blue-400 border border-blue-800';
      case 'Bloqueado':
        return 'bg-red-900/40 text-red-400 border border-red-800';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  }

  createTask() {
    const proyectIdStr = this.id();
    if (!proyectIdStr) return;

    if (!this.nombreTarea().trim()) {
      this.taskErrorMessage.set('El nombre de la tarea es obligatorio');
      return;
    }

    this.isSubmittingTask.set(true);
    this.taskErrorMessage.set('');

    this.taskService.createTask({
      nombre: this.nombreTarea().trim(),
      descripcion: this.descripcionTarea().trim(),
      comentario: this.comentarioTarea().trim(),
      estado: this.estadoTarea(),
      proyect_id: Number(proyectIdStr),
      tarea_padre_id: this.tareaPadreId() ?? undefined
    }).subscribe({
      next: () => {
        this.isSubmittingTask.set(false);
        this.closeTaskModal();
        // Reset form
        this.nombreTarea.set('');
        this.descripcionTarea.set('');
        this.comentarioTarea.set('');
        this.estadoTarea.set('Abierto');

        this.tasksResource?.reload();
      },
      error: (err) => {
        this.isSubmittingTask.set(false);
        this.taskErrorMessage.set(err.error || 'Error al crear la tarea');
      }
    });
  }

  changeTaskStatus(task: Task, nextEstado: string) {
    this.taskService.updateTask(task.id, { estado: nextEstado }).subscribe({
      next: () => {
        this.tasksResource?.reload();
      },
      error: (err) => console.error('Error al actualizar estado de tarea:', err)
    });
  }

  deleteTask(taskId: number) {
    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;

    this.taskService.deleteTask(taskId).subscribe({
      next: () => {
        this.tasksResource?.reload();
      },
      error: (err) => console.error('Error al eliminar tarea:', err)
    });
  }
}
