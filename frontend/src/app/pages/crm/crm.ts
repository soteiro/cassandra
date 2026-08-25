import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PersonaService } from '../../services/persona.service';
import { ToastService } from '../../services/toast.service';
import { PersonaRequest, PersonaResponse } from '../../models/persona.model';
import { PersonaCard } from '../../components/persona-card/persona-card';
import { PersonaModal } from '../../components/persona-modal/persona-modal';
import {
  LucideUsers,
  LucideUserPlus,
  LucidePlus,
  LucideRefreshCcw,
  LucideSearch,
  LucideFeather,
  LucideBrain,
  LucideArrowRight,
} from '@lucide/angular';

@Component({
  selector: 'app-crm',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PersonaCard,
    PersonaModal,
    LucideUsers,
    LucideUserPlus,
    LucidePlus,
    LucideRefreshCcw,
    LucideSearch,
    LucideFeather,
    LucideBrain,
    LucideArrowRight,
  ],
  templateUrl: './crm.html',
  styleUrl: './crm.css',
})
export class Crm {
  protected readonly personaService = inject(PersonaService);
  protected readonly toastService = inject(ToastService);
  protected readonly personasResource = this.personaService.personaResource;

  // Search signal
  searchQuery = signal('');

  // UI animation signals
  isRotating = signal(false);

  // Create Modal signals
  showModal = signal(false);
  isSubmitting = signal(false);

  reload() {
    this.isRotating.set(true);
    this.personaService.reload();
    setTimeout(() => this.isRotating.set(false), 600);
  }

  openCreateModal() {
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  handleCreatePersona(payload: any) {
    this.isSubmitting.set(true);

    this.personaService.createPersona(payload as PersonaRequest).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.reload();
        this.toastService.success('Persona registrada correctamente');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errorMsg =
          err.error?.message || err.error || 'Error al registrar la persona';
        this.toastService.error(errorMsg);
      },
    });
  }

  getMyProfile(personas: PersonaResponse[]): PersonaResponse | undefined {
    if (!personas) return undefined;
    return personas.find((p) => !p.eliminado && p.es_yo);
  }

  getFilteredContacts(personas: PersonaResponse[]): PersonaResponse[] {
    if (!personas) return [];

    let list = personas.filter((p) => !p.eliminado && !p.es_yo);
    const query = this.searchQuery().trim().toLowerCase();

    if (query) {
      list = list.filter(
        (p) =>
          p.nombre?.toLowerCase().includes(query) ||
          p.alias?.toLowerCase().includes(query)
      );
    }

    // Ordenar por fecha_creacion DESC (más recientes primero)
    return [...list].sort((a, b) => {
      const dateA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
      const dateB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
      return dateB - dateA;
    });
  }

  getStats(personas: PersonaResponse[]) {
    if (!personas || personas.length === 0) {
      return { total: 0, contactos: 0 };
    }
    const active = personas.filter((p) => !p.eliminado);
    const contactos = active.filter((p) => !p.es_yo);
    return { total: active.length, contactos: contactos.length };
  }
}

