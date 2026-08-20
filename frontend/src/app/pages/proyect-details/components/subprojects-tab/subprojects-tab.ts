import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectResponse } from '../../../../models/proyect.model';
import { ProjectCard } from '../../../../components/project-card/project-card';
import {
  LucideLayers,
  LucidePlus,
  LucideFolderPlus,
} from '@lucide/angular';

@Component({
  selector: 'app-subprojects-tab',
  imports: [
    CommonModule,
    ProjectCard,
    LucideLayers,
    LucidePlus,
    LucideFolderPlus,
  ],
  templateUrl: './subprojects-tab.html',
})
export class SubprojectsTab {
  subproyectos = input<ProjectResponse[]>([]);
  isLoading = input<boolean>(false);

  create = output<void>();

  getSortedSubprojects(): ProjectResponse[] {
    const list = this.subproyectos() || [];
    return [...list].sort((a, b) => {
      const weightA = this.getPriorityWeight(a.prioridad);
      const weightB = this.getPriorityWeight(b.prioridad);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      const dateA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
      const dateB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
      return dateB - dateA;
    });
  }

  private getPriorityWeight(priority?: string): number {
    switch (priority?.toLowerCase()) {
      case 'critica':
      case 'crítica':
        return 1;
      case 'alta':
        return 2;
      case 'media':
        return 3;
      case 'baja':
        return 4;
      default:
        return 5;
    }
  }
}
