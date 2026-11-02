import { LoadingDirective } from '../../../../shared/directives/loading.directive';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { PersonaService } from '../../data/persona.service';
import { InteraccionService } from '../../data/interaccion.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { PersonaResponse, PersonaUpdateRequest } from '../../data/persona.model';
import { InteraccionResponse } from '../../data/interaccion.model';
import { PersonaModal } from '../../components/persona-modal/persona-modal';
import { ConfirmModal } from '../../../../shared/ui/confirm-modal/confirm-modal';
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
import { getErrorMessage } from '../../../../shared/utils/http-error.util';

@Component({
  selector: 'app-persona-details',
  imports: [
    LoadingDirective,
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
      return 'bg-info/15 text-info-text border-info/30';
    }
    if (
      val.includes('cliente') ||
      val.includes('empresa') ||
      val.includes('negocio') ||
      val.includes('b2b')
    ) {
      return 'bg-insight/15 text-insight-text border-insight/30';
    }
    if (
      val.includes('familia') ||
      val.includes('pareja') ||
      val.includes('hogar')
    ) {
      return 'bg-personal/15 text-personal-text border-personal/30';
    }
    if (
      val.includes('amigo') ||
      val.includes('amistad') ||
      val.includes('social')
    ) {
      return 'bg-positive/15 text-positive-text border-positive/30';
    }
    if (
      val.includes('inver') ||
      val.includes('finanza') ||
      val.includes('socio') ||
      val.includes('partner')
    ) {
      return 'bg-warning/15 text-warning-text border-warning/30';
    }
    if (
      val.includes('universidad') ||
      val.includes('estudio') ||
      val.includes('mentor') ||
      val.includes('profe')
    ) {
      return 'bg-learning/15 text-learning-text border-learning/30';
    }

    return 'bg-primary/15 text-primary-text border-primary/30';
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
          // La lista global de personas es un recurso compartido: hay que refrescarla.
          this.personaService.reload();
        },
        error: (err) => {
          this.isSubmittingEdit.set(false);
          const errorMsg =
            getErrorMessage(err, 'Error al actualizar el perfil');
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
        this.personaService.reload();
        this.router.navigate(['/crm']);
      },
      error: (err) => {
        this.isDeleting.set(false);
        const errorMsg =
          getErrorMessage(err, 'Error al eliminar la persona');
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
            getErrorMessage(err, 'Error al registrar interacción');
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
