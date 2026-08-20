import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectResponse } from '../../models/proyect.model';
import {
  LucideFolder,
  LucideTarget,
  LucideCalendar,
  LucideClock,
  LucideArrowRight,
  LucideLayers,
  LucideCornerDownRight,
} from '@lucide/angular';

@Component({
  selector: 'app-project-card',
  imports: [
    CommonModule,
    RouterLink,
    LucideFolder,
    LucideTarget,
    LucideCalendar,
    LucideClock,
    LucideArrowRight,
    LucideLayers,
    LucideCornerDownRight,
  ],
  templateUrl: './project-card.html',
})
export class ProjectCard {
  project = input.required<ProjectResponse>();
  isSubproject = input<boolean>(false);

  getPriorityClass(priority?: string): string {
    switch (priority) {
      case 'Critica':
        return 'bg-danger/20 text-danger border border-danger/40';
      case 'Alta':
        return 'bg-amber-900/40 text-amber-300 border border-amber-800/60';
      case 'Media':
        return 'bg-blue-900/40 text-blue-300 border border-blue-800/60';
      default:
        return 'bg-surface-border/50 text-text-muted border border-surface-border';
    }
  }

  getStatusClass(estado?: string): string {
    switch (estado) {
      case 'Terminado':
      case 'Completado':
        return 'bg-success/20 text-success border border-success/40';
      case 'En Curso':
      case 'Activo':
        return 'bg-accent/20 text-accent border border-accent/40';
      case 'Bloqueado':
      case 'Pausado':
        return 'bg-danger/20 text-danger border border-danger/40';
      default:
        return 'bg-surface-border/50 text-text-muted border border-surface-border';
    }
  }
}
