import { Component, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InteraccionResponse } from '../../models/interaccion.model';
import { InteraccionService } from '../../services/interaccion.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmModal } from '../confirm-modal/confirm-modal';
import {
  LucideMessageSquare,
  LucideX,
  LucideCalendar,
  LucideClock,
  LucidePencil,
  LucideTrash2,
  LucideCopy,
  LucideCheck,
} from '@lucide/angular';

@Component({
  selector: 'app-interaccion-modal',
  imports: [
    CommonModule,
    FormsModule,
    ConfirmModal,
    LucideMessageSquare,
    LucideX,
    LucideCalendar,
    LucideClock,
    LucidePencil,
    LucideTrash2,
    LucideCopy,
    LucideCheck,
  ],
  templateUrl: './interaccion-modal.html',
})
export class InteraccionModal {
  private readonly interaccionService = inject(InteraccionService);
  private readonly toast = inject(ToastService);

  isOpen = input<boolean>(false);
  interaccion = input<InteraccionResponse | null>(null);

  close = output<void>();
  updated = output<void>();
  deleted = output<void>();

  // Cached item for smooth exit slide animation
  displayedItem = signal<InteraccionResponse | null>(null);

  // Edit mode signals
  isEditing = signal(false);
  editingText = signal('');
  isSubmitting = signal(false);

  // Delete signals
  showDeleteConfirm = signal(false);
  isDeleting = signal(false);

  // Copy state
  isCopied = signal(false);

  constructor() {
    effect(() => {
      const item = this.interaccion();
      if (item) {
        this.displayedItem.set(item);
        this.editingText.set(item.interaccion);
      }
      if (!this.isOpen()) {
        this.isEditing.set(false);
      }
    });
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('backdrop-layer')) {
      this.onClose();
    }
  }

  startEdit() {
    this.isEditing.set(true);
  }

  cancelEdit() {
    this.isEditing.set(false);
    const item = this.displayedItem();
    if (item) {
      this.editingText.set(item.interaccion);
    }
  }

  saveEdit() {
    const text = this.editingText().trim();
    if (!text) {
      this.toast.error('El texto de la interacción no puede estar vacío');
      return;
    }

    const current = this.displayedItem();
    if (!current) return;

    this.isSubmitting.set(true);
    this.interaccionService
      .updateInteraccion(current.id, { interaccion: text })
      .subscribe({
        next: () => {
          this.toast.success('Interacción actualizada');
          this.isSubmitting.set(false);
          this.isEditing.set(false);
          this.updated.emit();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const errorMsg =
            err.error?.message || err.error || 'Error al actualizar interacción';
          this.toast.error(errorMsg);
        },
      });
  }

  openDeleteModal() {
    this.showDeleteConfirm.set(true);
  }

  closeDeleteModal() {
    this.showDeleteConfirm.set(false);
  }

  confirmDelete() {
    const current = this.displayedItem();
    if (!current) return;

    this.isDeleting.set(true);
    this.interaccionService.deleteInteraccion(current.id).subscribe({
      next: () => {
        this.toast.success('Interacción eliminada');
        this.isDeleting.set(false);
        this.showDeleteConfirm.set(false);
        this.deleted.emit();
        this.onClose();
      },
      error: (err) => {
        this.isDeleting.set(false);
        const errorMsg =
          err.error?.message || err.error || 'Error al eliminar interacción';
        this.toast.error(errorMsg);
      },
    });
  }

  copyText() {
    const current = this.displayedItem();
    if (!current || !navigator?.clipboard) return;

    navigator.clipboard.writeText(current.interaccion).then(() => {
      this.isCopied.set(true);
      this.toast.success('Texto copiado al portapapeles');
      setTimeout(() => this.isCopied.set(false), 2000);
    });
  }

  onClose() {
    this.isEditing.set(false);
    this.close.emit();
  }
}
