import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotaService } from '../../../../services/nota.service';
import { TaskService } from '../../../../services/task.service';
import { ToastService } from '../../../../services/toast.service';
import { NotaProyecto } from '../../../../models/nota.model';
import { Task } from '../../../../models/task.model';
import { ConfirmModal } from '../../../../components/confirm-modal/confirm-modal';
import { TaskDetailModal } from '../../../../components/task-detail-modal/task-detail-modal';
import {
  LucideFileText,
  LucideSearch,
  LucideX,
  LucidePlus,
  LucideClock,
  LucideCopy,
  LucideCheck,
  LucidePencil,
  LucideTrash2,
  LucideListTodo,
} from '@lucide/angular';

@Component({
  selector: 'app-notes-tab',
  imports: [
    CommonModule,
    FormsModule,
    ConfirmModal,
    TaskDetailModal,
    LucideFileText,
    LucideSearch,
    LucideX,
    LucidePlus,
    LucideClock,
    LucideCopy,
    LucideCheck,
    LucidePencil,
    LucideTrash2,
    LucideListTodo,
  ],
  templateUrl: './notes-tab.html',
})
export class NotesTab {
  projectId = input.required<number>();
  notas = input<NotaProyecto[]>([]);
  tareas = input<Task[]>([]);
  isLoading = input<boolean>(false);

  reload = output<void>();

  private readonly notaService = inject(NotaService);
  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);

  selectedTask = signal<Task | null>(null);

  newNotaText = signal('');
  newNotaTareaId = signal<number | null>(null);
  isSubmittingNota = signal(false);

  editingNotaId = signal<number | null>(null);
  editingNotaText = signal('');
  editingNotaTareaId = signal<number | null>(null);
  isUpdatingNota = signal(false);

  notaToDelete = signal<NotaProyecto | null>(null);
  isDeletingNota = signal(false);

  notaSearchQuery = signal('');
  copiedNotaId = signal<number | null>(null);
  filterTipo = signal<'todas' | 'generales' | 'tareas'>('todas');

  // Solo se pueden enlazar tareas en estado "En Curso" para evitar listas infinitas
  tareasEnCurso = computed(() => {
    return (this.tareas() || []).filter((t) => t.estado === 'En Curso');
  });

  getLinkableTasks(currentSelectedId?: number | null): Task[] {
    return (this.tareas() || []).filter(
      (t) => t.estado === 'En Curso' || (currentSelectedId && t.id === currentSelectedId)
    );
  }

  createNota() {
    const text = this.newNotaText().trim();
    const pId = this.projectId();
    if (!text || !pId) return;

    this.isSubmittingNota.set(true);
    this.notaService.createNota(pId, {
      nota: text,
      tarea_id: this.newNotaTareaId() || undefined,
    }).subscribe({
      next: () => {
        this.toastService.success('Nota guardada');
        this.newNotaText.set('');
        this.newNotaTareaId.set(null);
        this.isSubmittingNota.set(false);
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al guardar la nota');
        console.error('Error al crear nota:', err);
        this.isSubmittingNota.set(false);
      },
    });
  }

  startEditNota(nota: NotaProyecto) {
    this.editingNotaId.set(nota.id);
    this.editingNotaText.set(nota.nota);
    this.editingNotaTareaId.set(nota.tarea_id || null);
  }

  cancelEditNota() {
    this.editingNotaId.set(null);
    this.editingNotaText.set('');
    this.editingNotaTareaId.set(null);
  }

  saveEditNota(nota: NotaProyecto) {
    const text = this.editingNotaText().trim();
    if (!text) {
      this.toastService.error('La nota no puede estar vacía');
      return;
    }

    const tareaIdVal = this.editingNotaTareaId();

    this.isUpdatingNota.set(true);
    this.notaService.updateNota(nota.id, {
      nota: text,
      tarea_id: tareaIdVal,
      clear_tarea_id: tareaIdVal === null,
    }).subscribe({
      next: () => {
        this.toastService.success('Nota actualizada');
        this.cancelEditNota();
        this.isUpdatingNota.set(false);
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al actualizar la nota');
        console.error('Error al actualizar nota:', err);
        this.isUpdatingNota.set(false);
      },
    });
  }

  openDeleteNotaModal(nota: NotaProyecto) {
    this.notaToDelete.set(nota);
  }

  confirmDeleteNota() {
    const nota = this.notaToDelete();
    if (!nota) return;

    this.isDeletingNota.set(true);
    this.notaService.deleteNota(nota.id).subscribe({
      next: () => {
        this.toastService.success('Nota eliminada');
        this.isDeletingNota.set(false);
        this.notaToDelete.set(null);
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al eliminar la nota');
        console.error('Error al eliminar nota:', err);
        this.isDeletingNota.set(false);
      },
    });
  }

  cancelDeleteNota() {
    this.notaToDelete.set(null);
  }

  getFilteredNotas(notas: NotaProyecto[]): NotaProyecto[] {
    let result = notas || [];

    if (this.filterTipo() === 'generales') {
      result = result.filter((n) => !n.tarea_id);
    } else if (this.filterTipo() === 'tareas') {
      result = result.filter((n) => !!n.tarea_id);
    }

    const query = this.notaSearchQuery().toLowerCase().trim();
    if (query) {
      result = result.filter(
        (n) =>
          n.nota.toLowerCase().includes(query) ||
          (n.tarea_nombre && n.tarea_nombre.toLowerCase().includes(query))
      );
    }

    return result;
  }

  getTaskNombre(tareaId?: number | null): string {
    if (!tareaId) return '';
    const t = this.tareas().find((item) => item.id === tareaId);
    return t ? t.nombre : '';
  }

  getGeneralesCount(): number {
    return (this.notas() || []).filter((n) => !n.tarea_id).length;
  }

  getTareasCount(): number {
    return (this.notas() || []).filter((n) => !!n.tarea_id).length;
  }


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

  openTaskModal(tareaId?: number | null) {
    if (!tareaId) return;

    // 1. Buscar en tareas principales
    let foundTask = (this.tareas() || []).find((t) => t.id === tareaId);

    // 2. Si no es tarea principal, buscar en las subtareas
    if (!foundTask) {
      for (const t of this.tareas() || []) {
        if (t.subtareas && t.subtareas.length > 0) {
          const sub = t.subtareas.find((s) => s.id === tareaId);
          if (sub) {
            foundTask = sub;
            break;
          }
        }
      }
    }

    if (foundTask) {
      this.selectedTask.set(foundTask);
    } else {
      // 3. Fallback: cargar por API si no estuviera precargada en la lista
      this.taskService.getTaskById(tareaId).subscribe({
        next: (t) => this.selectedTask.set(t),
        error: (err) => {
          this.toastService.error('No se pudo cargar la tarea vinculada');
          console.error('Error al cargar tarea vinculada:', err);
        },
      });
    }
  }

  onTaskModalUpdated() {
    this.reload.emit();
  }

  onTaskModalDeleted(deletedId: number) {
    this.selectedTask.set(null);
    this.reload.emit();
  }
}

