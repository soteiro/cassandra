import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-task-detail-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './task-detail-modal.html',
})
export class TaskDetailModal {
  private readonly taskService = inject(TaskService);

  // Inputs
  task = input.required<Task>();
  proyectId = input.required<number>();

  // Outputs
  closeModal = output<void>();
  taskUpdated = output<void>();

  // Subtarea formulario en línea
  nuevaSubtareaNombre = signal('');
  isSubmittingSubtarea = signal(false);

  // Subtareas computadas
  subtareas = computed(() => this.task().subtareas || []);
  totalSubtareas = computed(() => this.subtareas().length);
  completadasCount = computed(() => this.subtareas().filter((s) => s.estado === 'Terminado').length);

  porcentajeProgreso = computed(() => {
    const total = this.totalSubtareas();
    if (total === 0) return 0;
    return Math.round((this.completadasCount() / total) * 100);
  });

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

  changeParentStatus(nextEstado: string) {
    this.taskService.updateTask(this.task().id, { estado: nextEstado }).subscribe({
      next: () => this.taskUpdated.emit(),
      error: (err) => console.error('Error al actualizar tarea:', err),
    });
  }

  addSubtarea() {
    const nombre = this.nuevaSubtareaNombre().trim();
    if (!nombre) return;

    this.isSubmittingSubtarea.set(true);

    this.taskService
      .createTask({
        nombre,
        descripcion: '',
        comentario: '',
        estado: 'Abierto',
        proyect_id: this.proyectId(),
        tarea_padre_id: this.task().id,
      })
      .subscribe({
        next: () => {
          this.nuevaSubtareaNombre.set('');
          this.isSubmittingSubtarea.set(false);
          this.taskUpdated.emit();
        },
        error: (err) => {
          console.error('Error al crear subtarea:', err);
          this.isSubmittingSubtarea.set(false);
        },
      });
  }

  toggleSubtareaStatus(subtarea: Task) {
    const nextEstado = subtarea.estado === 'Terminado' ? 'Abierto' : 'Terminado';
    this.taskService.updateTask(subtarea.id, { estado: nextEstado }).subscribe({
      next: () => this.taskUpdated.emit(),
      error: (err) => console.error('Error al cambiar estado de subtarea:', err),
    });
  }

  changeSubtareaStatus(subtarea: Task, nextEstado: string) {
    this.taskService.updateTask(subtarea.id, { estado: nextEstado }).subscribe({
      next: () => this.taskUpdated.emit(),
      error: (err) => console.error('Error al actualizar subtarea:', err),
    });
  }

  deleteSubtarea(subtareaId: number) {
    if (!confirm('¿Eliminar esta subtarea?')) return;
    this.taskService.deleteTask(subtareaId).subscribe({
      next: () => this.taskUpdated.emit(),
      error: (err) => console.error('Error al eliminar subtarea:', err),
    });
  }

  onClose() {
    this.closeModal.emit();
  }
}
