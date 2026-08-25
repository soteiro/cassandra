import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { PersonaService } from '../../services/persona.service';
import { InteraccionService } from '../../services/interaccion.service';
import { ToastService } from '../../services/toast.service';
import { PersonaResponse, PersonaUpdateRequest } from '../../models/persona.model';
import { InteraccionResponse } from '../../models/interaccion.model';
import { PersonaModal } from '../../components/persona-modal/persona-modal';
import { ConfirmModal } from '../../components/confirm-modal/confirm-modal';
import { InteraccionModal } from '../../components/interaccion-modal/interaccion-modal';
import { ReflexionesView } from '../../components/reflexiones-view/reflexiones-view';
import {
  LucideArrowLeft,
  LucidePencil,
  LucideTrash2,
  LucideCalendar,
  LucideTag,
  LucideInfo,
  LucideMessageSquare,
  LucidePlus,
  LucideArrowRight,
  LucideClock,
} from '@lucide/angular';

@Component({
  selector: 'app-persona-details',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    PersonaModal,
    ConfirmModal,
    InteraccionModal,
    ReflexionesView,
    LucideArrowLeft,
    LucidePencil,
    LucideTrash2,
    LucideCalendar,
    LucideTag,
    LucideInfo,
    LucideMessageSquare,
    LucidePlus,
    LucideArrowRight,
    LucideClock,
  ],
  templateUrl: './persona-details.html',
  styleUrl: './persona-details.css',
})
export class PersonaDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly personaService = inject(PersonaService);
  private readonly interaccionService = inject(InteraccionService);
  private readonly toast = inject(ToastService);

  private readonly paramMap = toSignal(this.route.paramMap);
  protected readonly id = () => this.paramMap()?.get('id') ?? null;
  protected readonly personaIdNumber = () => Number(this.id());

  // Resources
  protected readonly personaResource = this.personaService.getPersonaById(this.id);
  protected readonly interaccionesResource =
    this.interaccionService.getInteraccionesByPersonaId(this.id);

  // Edit Persona Modal signals
  showEditModal = signal(false);
  isSubmittingEdit = signal(false);

  // Delete Persona Modal signals
  showDeleteModal = signal(false);
  isDeleting = signal(false);

  // Add Interaction signals
  showAddInteraccion = signal(false);
  nuevaInteraccionTexto = signal('');
  isSubmittingInteraccion = signal(false);

  // Right-hand Side Drawer Detail Modal signals
  selectedInteraccion = signal<InteraccionResponse | null>(null);
  showDetailDrawer = signal(false);

  get avatarUrl(): string {
    const idVal = this.id();
    return idVal
      ? `https://robohash.org/${idVal}?size=200x200`
      : 'https://robohash.org/1?size=200x200';
  }

  getEntornoBadgeClass(entorno?: string): string {
    if (!entorno) {
      return 'bg-surface-border/50 text-text-muted border-surface-border';
    }

    const val = entorno.toLowerCase().trim();
    if (
      val.includes('trabajo') ||
      val.includes('work') ||
      val.includes('laboral') ||
      val.includes('oficina')
    ) {
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
    if (
      val.includes('cliente') ||
      val.includes('empresa') ||
      val.includes('negocio') ||
      val.includes('b2b')
    ) {
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    }
    if (
      val.includes('familia') ||
      val.includes('pareja') ||
      val.includes('hogar')
    ) {
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
    if (
      val.includes('amigo') ||
      val.includes('amistad') ||
      val.includes('social')
    ) {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (
      val.includes('inver') ||
      val.includes('finanza') ||
      val.includes('socio') ||
      val.includes('partner')
    ) {
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
    if (
      val.includes('universidad') ||
      val.includes('estudio') ||
      val.includes('mentor') ||
      val.includes('profe')
    ) {
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    }

    return 'bg-primary/15 text-primary border-primary/30';
  }

  // --- EDIT PERSONA ---
  openEditModal() {
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
  }

  saveEditPersona(payload: any) {
    this.isSubmittingEdit.set(true);

    this.personaService
      .updatePersona(this.personaIdNumber(), payload as PersonaUpdateRequest)
      .subscribe({
        next: () => {
          this.toast.success('Perfil actualizado correctamente');
          this.isSubmittingEdit.set(false);
          this.closeEditModal();
          this.personaResource?.reload();
        },
        error: (err) => {
          this.isSubmittingEdit.set(false);
          const errorMsg =
            err.error?.message || err.error || 'Error al actualizar el perfil';
          this.toast.error(errorMsg);
        },
      });
  }

  // --- DELETE PERSONA ---
  openDeleteModal() {
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
  }

  confirmDeletePersona() {
    this.isDeleting.set(true);

    this.personaService.deletePersona(this.personaIdNumber()).subscribe({
      next: () => {
        this.toast.success('Persona eliminada del CRM');
        this.isDeleting.set(false);
        this.closeDeleteModal();
        this.router.navigate(['/crm']);
      },
      error: (err) => {
        this.isDeleting.set(false);
        const errorMsg =
          err.error?.message || err.error || 'Error al eliminar la persona';
        this.toast.error(errorMsg);
      },
    });
  }

  // --- ADD INTERACCIÓN ---
  createInteraccion() {
    const text = this.nuevaInteraccionTexto().trim();
    const pId = this.personaIdNumber();
    if (!text || !pId) return;

    this.isSubmittingInteraccion.set(true);
    this.interaccionService
      .createInteraccion(pId, { interaccion: text })
      .subscribe({
        next: () => {
          this.toast.success('Interacción registrada');
          this.nuevaInteraccionTexto.set('');
          this.isSubmittingInteraccion.set(false);
          this.showAddInteraccion.set(false);
          this.interaccionesResource?.reload();
        },
        error: (err) => {
          this.isSubmittingInteraccion.set(false);
          const errorMsg =
            err.error?.message || err.error || 'Error al registrar interacción';
          this.toast.error(errorMsg);
        },
      });
  }

  // --- RIGHT DRAWER MODAL ---
  openInteraccionDetail(item: InteraccionResponse) {
    this.selectedInteraccion.set(item);
    this.showDetailDrawer.set(true);
  }

  closeInteraccionDetail() {
    this.showDetailDrawer.set(false);
    this.selectedInteraccion.set(null);
  }

  onInteraccionChanged() {
    this.interaccionesResource?.reload();
  }
}
