import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotaService } from '../../../../services/nota.service';
import { ToastService } from '../../../../services/toast.service';
import { NotaProyecto } from '../../../../models/nota.model';
import { ConfirmModal } from '../../../../components/confirm-modal/confirm-modal';
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
} from '@lucide/angular';

@Component({
  selector: 'app-notes-tab',
  imports: [
    CommonModule,
    FormsModule,
    ConfirmModal,
    LucideFileText,
    LucideSearch,
    LucideX,
    LucidePlus,
    LucideClock,
    LucideCopy,
    LucideCheck,
    LucidePencil,
    LucideTrash2,
  ],
  templateUrl: './notes-tab.html',
})
export class NotesTab {
  projectId = input.required<number>();
  notas = input<NotaProyecto[]>([]);
  isLoading = input<boolean>(false);

  reload = output<void>();

  private readonly notaService = inject(NotaService);
  private readonly toastService = inject(ToastService);

  newNotaText = signal('');
  isSubmittingNota = signal(false);

  editingNotaId = signal<number | null>(null);
  editingNotaText = signal('');
  isUpdatingNota = signal(false);

  notaToDelete = signal<NotaProyecto | null>(null);
  isDeletingNota = signal(false);

  notaSearchQuery = signal('');
  copiedNotaId = signal<number | null>(null);

  createNota() {
    const text = this.newNotaText().trim();
    const pId = this.projectId();
    if (!text || !pId) return;

    this.isSubmittingNota.set(true);
    this.notaService.createNota(pId, { nota: text }).subscribe({
      next: () => {
        this.toastService.success('Nota guardada');
        this.newNotaText.set('');
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
  }

  cancelEditNota() {
    this.editingNotaId.set(null);
    this.editingNotaText.set('');
  }

  saveEditNota(nota: NotaProyecto) {
    const text = this.editingNotaText().trim();
    if (!text) {
      this.toastService.error('La nota no puede estar vacía');
      return;
    }

    this.isUpdatingNota.set(true);
    this.notaService.updateNota(nota.id, { nota: text }).subscribe({
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
    const query = this.notaSearchQuery().toLowerCase().trim();
    if (!query) return notas || [];
    return (notas || []).filter((n) => n.nota.toLowerCase().includes(query));
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
}
