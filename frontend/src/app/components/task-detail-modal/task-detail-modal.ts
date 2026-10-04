import { Component, effect, inject, input, output, signal, computed, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, TaskPrioridad } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { ToastService } from '../../services/toast.service';
import { BackButtonService } from '../../services/back-button.service';
import { NotaService } from '../../services/nota.service';
import { NotaProyecto } from '../../models/nota.model';
import {
  LucideX,
  LucideCheck,
  LucidePlus,
  LucideTrash2,
  LucideSave,
  LucideCornerDownRight,
  LucideFileText,
  LucideCopy,
} from '@lucide/angular';
import { TaskStatusSelect } from '../task-status-select/task-status-select';
import { TaskPrioritySelect } from '../task-priority-select/task-priority-select';
import { getTaskPriorityBorderClass } from '../../utils/task-styles.util';

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
    LucideFileText,
    LucideCopy,
    TaskStatusSelect,
    TaskPrioritySelect,
  ],
  templateUrl: './task-detail-modal.html',
})
export class TaskDetailModal {
  private readonly taskService = inject(TaskService);
  private readonly notaService = inject(NotaService);
  private readonly toastService = inject(ToastService);
  private readonly backButtonService = inject(BackButtonService);

  // Inputs
  isOpen = input<boolean>(false);
  task = input<Task | null>(null);
  proyectId = input.required<number>();

  // Outputs
  closeModal = output<void>();
  taskUpdated = output<void>();
  taskDeleted = output<number>();

  private readonly _backBtnEffect = this.backButtonService.registerEffect(
    () => this.isOpen(),
    () => this.onClose(),
    80
  );

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

  // Notas de la tarea (Cápsulas de bitácora y solución)
  taskNotas = signal<NotaProyecto[]>([]);
  isLoadingNotas = signal(false);
  newNotaTexto = signal('');
  isSavingNota = signal(false);
  copiedNotaId = signal<number | null>(null);

  copyNotaContent(nota: NotaProyecto) {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(nota.nota).then(() => {
      this.copiedNotaId.set(nota.id);
      this.toastService.success('Nota copiada al portapapeles');
      setTimeout(() => {
        if (this.copiedNotaId() === nota.id) {
          this.copiedNotaId.set(null);
        }
      }, 2000);
    });
  }

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
    this.newNotaTexto.set('');
    this.isSavingNota.set(false);
    this.loadTaskNotas(t.id);
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
          this.updateSubtareas((subs) => [...subs, newSub]);
          this.taskUpdated.emit();
        },
        error: (err) => {
          this.isSubmittingSubtarea.set(false);
          this.toastService.error('Error al crear subtarea');
          console.error('Error al crear subtarea:', err);
        },
      });
  }

  // Actualiza las subtareas de forma inmutable para que los computed se recalculen.
  private updateSubtareas(fn: (subtareas: Task[]) => Task[]) {
    this.currentTask.update((t) => (t ? { ...t, subtareas: fn(t.subtareas ?? []) } : t));
  }

  private setSubtareaEstado(id: number, estado: string) {
    this.updateSubtareas((subs) => subs.map((s) => (s.id === id ? { ...s, estado } : s)));
  }

  toggleSubtareaStatus(subtarea: Task) {
    const prev = subtarea.estado;
    const nextEstado = subtarea.estado === 'Terminado' ? 'Abierto' : 'Terminado';
    this.setSubtareaEstado(subtarea.id, nextEstado);
    this.taskService.updateTask(subtarea.id, { estado: nextEstado }).subscribe({
      next: () => this.taskUpdated.emit(),
      error: (err) => {
        this.setSubtareaEstado(subtarea.id, prev);
        this.toastService.error('Error al cambiar estado de subtarea');
        console.error('Error al cambiar estado de subtarea:', err);
      },
    });
  }

  deleteSubtarea(subtareaId: number) {
    if (!confirm('¿Eliminar esta subtarea?')) return;
    this.taskService.deleteTask(subtareaId).subscribe({
      next: () => {
        this.updateSubtareas((subs) => subs.filter((s) => s.id !== subtareaId));
        this.toastService.success('Subtarea eliminada');
        this.taskUpdated.emit();
      },
      error: (err) => console.error('Error al eliminar subtarea:', err),
    });
  }

  getPriorityBorderClass(prioridad?: string): string {
    return getTaskPriorityBorderClass(prioridad);
  }

  loadTaskNotas(tareaId: number) {
    this.isLoadingNotas.set(true);
    this.notaService.getNotasByTareaId(tareaId).subscribe({
      next: (notas) => {
        this.taskNotas.set(notas || []);
        this.isLoadingNotas.set(false);
      },
      error: (err) => {
        console.error('Error al cargar notas de la tarea:', err);
        this.isLoadingNotas.set(false);
      },
    });
  }

  addTaskNota() {
    const t = this.currentTask();
    const text = this.newNotaTexto().trim();
    if (!t || !text) return;

    this.isSavingNota.set(true);
    this.notaService
      .createNota(this.proyectId(), {
        nota: text,
        tarea_id: t.id,
      })
      .subscribe({
        next: (nuevaNota) => {
          this.isSavingNota.set(false);
          this.newNotaTexto.set('');
          this.taskNotas.update((list) => [nuevaNota, ...list]);
          this.toastService.success('Cápsula de solución guardada');
          this.taskUpdated.emit();
        },
        error: (err) => {
          this.isSavingNota.set(false);
          this.toastService.error('Error al guardar nota');
          console.error('Error al crear nota de tarea:', err);
        },
      });
  }

  deleteTaskNota(notaId: number) {
    if (!confirm('¿Eliminar esta cápsula de nota?')) return;
    this.notaService.deleteNota(notaId).subscribe({
      next: () => {
        this.taskNotas.update((list) => list.filter((n) => n.id !== notaId));
        this.toastService.success('Nota eliminada');
        this.taskUpdated.emit();
      },
      error: (err) => {
        this.toastService.error('Error al eliminar nota');
        console.error('Error al eliminar nota:', err);
      },
    });
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
