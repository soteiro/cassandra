import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectResponse } from '../../../../models/proyect.model';
import {
  LucideCornerDownRight,
  LucideLayers,
  LucidePencil,
  LucideTrash2,
  LucideTarget,
} from '@lucide/angular';

@Component({
  selector: 'app-project-header',
  imports: [
    CommonModule,
    RouterLink,
    LucideCornerDownRight,
    LucideLayers,
    LucidePencil,
    LucideTrash2,
    LucideTarget,
  ],
  templateUrl: './project-header.html',
})
export class ProjectHeader {
  project = input.required<ProjectResponse>();

  edit = output<void>();
  delete = output<void>();

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
}
