import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReflexionService } from '../../services/reflexion.service';
import { ToastService } from '../../services/toast.service';
import { PersonaResponse } from '../../models/persona.model';
import {
  ReflexionResponse,
  ReflexionTipo,
  ReflexionUpdateRequest,
} from '../../models/reflexion.model';
import { ReflexionModal } from '../reflexion-modal/reflexion-modal';
import { ConfirmModal } from '../confirm-modal/confirm-modal';
import {
  LucidePlus,
  LucideClock,
  LucidePencil,
  LucideTrash2,
  LucideCopy,
  LucideBookOpen,
  LucideFeather,
} from '@lucide/angular';

@Component({
  selector: 'app-reflexiones-view',
  imports: [
    CommonModule,
    FormsModule,
    ReflexionModal,
    ConfirmModal,
    LucidePlus,
    LucideClock,
    LucidePencil,
    LucideTrash2,
    LucideCopy,
    LucideBookOpen,
    LucideFeather,
  ],
  templateUrl: './reflexiones-view.html',
})
export class ReflexionesView {
  private readonly reflexionService = inject(ReflexionService);
  private readonly toast = inject(ToastService);

  persona = input<PersonaResponse | null>(null);

  // Active filter tab: 'todas' | 'reflexion' | 'memoria' | 'evento'
  activeFilter = signal<string>('todas');

  // Resource
  protected readonly reflexionesResource =
    this.reflexionService.getReflexionesByTipo(this.activeFilter);

  // Quick writer signals
  nuevoTexto = signal('');
  nuevoTipo = signal<ReflexionTipo>('reflexion');
  isSubmittingNuevo = signal(false);

  // Edit modal signals
  showEditModal = signal(false);
  selectedReflexion = signal<ReflexionResponse | null>(null);
  isSubmittingEdit = signal(false);

  // Delete modal signals
  showDeleteModal = signal(false);
  itemToDelete = signal<ReflexionResponse | null>(null);
  isDeleting = signal(false);

  // Words count in writer
  wordCount = computed(() => {
    const text = this.nuevoTexto().trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  });

  // Calculate statistics from current items
  stats = computed(() => {
    const items = this.reflexionesResource?.value() || [];
    return {
      total: items.length,
      reflexiones: items.filter((i) => i.tipo === 'reflexion').length,
      memorias: items.filter((i) => i.tipo === 'memoria').length,
      eventos: items.filter((i) => i.tipo === 'evento').length,
    };
  });

  get avatarUrl(): string {
    const p = this.persona();
    return p?.id
      ? `https://robohash.org/${p.id}?size=200x200`
      : 'https://robohash.org/yo?size=200x200';
  }

  setFilter(filtro: string) {
    this.activeFilter.set(filtro);
  }

  setNuevoTipo(t: ReflexionTipo) {
    this.nuevoTipo.set(t);
  }

  createReflexion() {
    const text = this.nuevoTexto().trim();
    if (!text) return;

    this.isSubmittingNuevo.set(true);
    this.reflexionService
      .createReflexion({
        reflexion: text,
        tipo: this.nuevoTipo(),
      })
      .subscribe({
        next: () => {
          this.toast.success('Entrada guardada en tu bitácora');
          this.nuevoTexto.set('');
          this.isSubmittingNuevo.set(false);
          this.reflexionesResource?.reload();
        },
        error: (err) => {
          this.isSubmittingNuevo.set(false);
          const errorMsg =
            err.error?.message || err.error || 'Error al guardar la reflexión';
          this.toast.error(errorMsg);
        },
      });
  }

  // --- EDIT ---
  openEdit(item: ReflexionResponse) {
    this.selectedReflexion.set(item);
    this.showEditModal.set(true);
  }

  closeEdit() {
    this.showEditModal.set(false);
    this.selectedReflexion.set(null);
  }

  saveEdit(payload: ReflexionUpdateRequest) {
    const item = this.selectedReflexion();
    if (!item) return;

    this.isSubmittingEdit.set(true);
    this.reflexionService.updateReflexion(item.id, payload).subscribe({
      next: () => {
        this.toast.success('Entrada actualizada correctamente');
        this.isSubmittingEdit.set(false);
        this.closeEdit();
        this.reflexionesResource?.reload();
      },
      error: (err) => {
        this.isSubmittingEdit.set(false);
        const errorMsg =
          err.error?.message || err.error || 'Error al actualizar la entrada';
        this.toast.error(errorMsg);
      },
    });
  }

  // --- DELETE ---
  openDelete(item: ReflexionResponse) {
    this.itemToDelete.set(item);
    this.showDeleteModal.set(true);
  }

  closeDelete() {
    this.showDeleteModal.set(false);
    this.itemToDelete.set(null);
  }

  confirmDelete() {
    const item = this.itemToDelete();
    if (!item) return;

    this.isDeleting.set(true);
    this.reflexionService.deleteReflexion(item.id).subscribe({
      next: () => {
        this.toast.success('Entrada eliminada');
        this.isDeleting.set(false);
        this.closeDelete();
        this.reflexionesResource?.reload();
      },
      error: (err) => {
        this.isDeleting.set(false);
        const errorMsg =
          err.error?.message || err.error || 'Error al eliminar la entrada';
        this.toast.error(errorMsg);
      },
    });
  }

  copyContent(item: ReflexionResponse) {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(item.reflexion).then(() => {
      this.toast.success('Texto copiado al portapapeles');
    });
  }

  getBadgeClass(tipo: ReflexionTipo): string {
    switch (tipo) {
      case 'reflexion':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'memoria':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'evento':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      default:
        return 'bg-primary/15 text-primary border-primary/30';
    }
  }

  getTipoIcon(tipo: ReflexionTipo): string {
    switch (tipo) {
      case 'reflexion':
        return '🧠';
      case 'memoria':
        return '💭';
      case 'evento':
        return '📅';
      default:
        return '✍️';
    }
  }
}
