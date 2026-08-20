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
}
