import { Component, effect, inject, input, output, signal, computed, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, TaskPrioridad } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { ToastService } from '../../services/toast.service';
import {
  LucideX,
  LucideCheck,
  LucidePlus,
  LucideTrash2,
  LucideSave,
  LucideCornerDownRight,
} from '@lucide/angular';

@Component({
  selector: 'app-task-detail-modal',
  imports: [
    CommonModule,
    FormsModule,
    LucideX,
    LucideCheck,
    LucidePlus,
    LucideTrash2,
    LucideSave,
    LucideCornerDownRight,
  ],
  templateUrl: './task-detail-modal.html',
})
export class TaskDetailModal {
  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);

  // Inputs
  isOpen = input<boolean>(false);
  task = input<Task | null>(null);
  proyectId = input.required<number>();

  // Outputs
  closeModal = output<void>();
  taskUpdated = output<void>();
  taskDeleted = output<number>();

  // Visibility & Render state for smooth transitions
  shouldRender = signal(false);
  isVisible = signal(false);

  // Form signals
  currentTask = signal<Task | null>(null);
  nombre = signal('');
  descripcion = signal('');
  comentario = signal('');
  estado = signal('Abierto');
  prioridad = signal<TaskPrioridad>('normal');

  isSaving = signal(false);
  isDeleting = signal(false);

  // Subtarea formulario en línea
  nuevaSubtareaNombre = signal('');
  isSubmittingSubtarea = signal(false);

  // Subtareas computadas
  subtareas = computed(() => this.currentTask()?.subtareas || []);
  totalSubtareas = computed(() => this.subtareas().length);
  completadasCount = computed(() => this.subtareas().filter((s) => s.estado === 'Terminado').length);

  porcentajeProgreso = computed(() => {
    const total = this.totalSubtareas();
    if (total === 0) return 0;
    return Math.round((this.completadasCount() / total) * 100);
  });

  private animTimer: any = null;

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const t = this.task();

      if (open && t) {
        if (this.animTimer) {
          clearTimeout(this.animTimer);
          this.animTimer = null;
        }
        this.currentTask.set(t);
        this.populateForm(t);
        this.shouldRender.set(true);
        // Wait a frame so initial translate-x-full is registered before transitioning to translate-x-0
        this.animTimer = setTimeout(() => {
          this.isVisible.set(true);
          this.animTimer = null;
        }, 25);
      } else if (!open && this.shouldRender()) {
        this.isVisible.set(false);
        if (this.animTimer) {
          clearTimeout(this.animTimer);
        }
        this.animTimer = setTimeout(() => {
          this.shouldRender.set(false);
          this.animTimer = null;
        }, 300);
      }
    });
  }

  private populateForm(t: Task) {
    this.nombre.set(t.nombre || '');
    this.descripcion.set(t.descripcion || '');
    this.comentario.set(t.comentario || '');
    this.estado.set(t.estado || 'Abierto');
    this.prioridad.set((t.prioridad as TaskPrioridad) || 'normal');
    this.nuevaSubtareaNombre.set('');
    this.isSaving.set(false);
    this.isDeleting.set(false);
  }

  ngOnDestroy() {
    if (this.animTimer) {
      clearTimeout(this.animTimer);
      this.animTimer = null;
    }
  }

  @HostListener('window:keydown.escape')
  handleEscape() {
    if (this.isOpen() || this.isVisible()) {
      this.onClose();
    }
  }

  saveTask() {
    const t = this.currentTask();
    if (!t) return;

    const nombreVal = this.nombre().trim();
    if (!nombreVal) {
      this.toastService.error('El nombre de la tarea no puede estar vacío');
      return;
    }

    this.isSaving.set(true);

    this.taskService
      .updateTask(t.id, {
        nombre: nombreVal,
        descripcion: this.descripcion().trim(),
        comentario: this.comentario().trim(),
        estado: this.estado(),
        prioridad: this.prioridad(),
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.toastService.success('Tarea guardada exitosamente');
          t.nombre = nombreVal;
          t.descripcion = this.descripcion().trim();
          t.comentario = this.comentario().trim();
          t.estado = this.estado();
          t.prioridad = this.prioridad();
          this.taskUpdated.emit();
          this.onClose();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toastService.error('Error al guardar la tarea');
          console.error('Error al actualizar tarea:', err);
        },
      });
  }

  deleteCurrentTask() {
    const t = this.currentTask();
    if (!t) return;

    if (!confirm(`¿Estás seguro de eliminar «${t.nombre}»?`)) return;

    this.isDeleting.set(true);
    this.taskService.deleteTask(t.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.toastService.success('Tarea eliminada');
        this.taskDeleted.emit(t.id);
        this.taskUpdated.emit();
        this.onClose();
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.toastService.error('Error al eliminar tarea');
        console.error('Error al eliminar tarea:', err);
      },
    });
  }

  addSubtarea() {
    const t = this.currentTask();
    if (!t) return;
    const nombre = this.nuevaSubtareaNombre().trim();
    if (!nombre) return;

    this.isSubmittingSubtarea.set(true);

    this.taskService
      .createTask({
        nombre,
        descripcion: '',
        comentario: '',
        estado: 'Abierto',
        prioridad: 'normal',
        proyect_id: this.proyectId(),
        tarea_padre_id: t.id,
      })
      .subscribe({
        next: (newSub) => {
          this.nuevaSubtareaNombre.set('');
          this.isSubmittingSubtarea.set(false);
          this.toastService.success('Subtarea añadida');
          if (!t.subtareas) t.subtareas = [];
          t.subtareas.push(newSub);
          this.taskUpdated.emit();
        },
        error: (err) => {
          this.isSubmittingSubtarea.set(false);
          this.toastService.error('Error al crear subtarea');
          console.error('Error al crear subtarea:', err);
        },
      });
  }

  toggleSubtareaStatus(subtarea: Task) {
    const nextEstado = subtarea.estado === 'Terminado' ? 'Abierto' : 'Terminado';
    subtarea.estado = nextEstado;
    this.taskService.updateTask(subtarea.id, { estado: nextEstado }).subscribe({
      next: () => this.taskUpdated.emit(),
      error: (err) => console.error('Error al cambiar estado de subtarea:', err),
    });
  }

  deleteSubtarea(subtareaId: number) {
    const t = this.currentTask();
    if (!confirm('¿Eliminar esta subtarea?')) return;
    this.taskService.deleteTask(subtareaId).subscribe({
      next: () => {
        if (t && t.subtareas) {
          t.subtareas = t.subtareas.filter((s) => s.id !== subtareaId);
        }
        this.toastService.success('Subtarea eliminada');
        this.taskUpdated.emit();
      },
      error: (err) => console.error('Error al eliminar subtarea:', err),
    });
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

  getStatusBadgeClass(estado?: string): string {
    switch (estado) {
      case 'Terminado':
        return 'bg-success/15 text-success border-success/30';
      case 'En Curso':
        return 'bg-accent/15 text-accent border-accent/30';
      case 'Bloqueado':
        return 'bg-danger/15 text-danger border-danger/30';
      default:
        return 'bg-surface-border/50 text-text-muted border-surface-border';
    }
  }

  onClose() {
    this.isVisible.set(false);
    if (this.animTimer) {
      clearTimeout(this.animTimer);
    }
    this.animTimer = setTimeout(() => {
      this.shouldRender.set(false);
      this.closeModal.emit();
      this.animTimer = null;
    }, 300);
  }
}
