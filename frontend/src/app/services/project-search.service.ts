import { Injectable, computed, inject } from '@angular/core';
import { proyectService } from './proyect.service';
import { ProjectResponse } from '../models/proyect.model';

export interface ProjectMatch {
  project: ProjectResponse;
  path: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectSearchService {
  private readonly proyectService = inject(proyectService);

  private readonly projects = computed(() => this.proyectService.proyectResource.value() ?? []);

  private pathFor(project: ProjectResponse): string {
    return project.nombre_padre ? `${project.nombre_padre} / ${project.nombre}` : project.nombre;
  }

  search(query: string, limit = 8): ProjectMatch[] {
    const all = this.projects();
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return all.slice(0, limit).map((project) => ({ project, path: this.pathFor(project) }));
    }

    const startsWith: ProjectResponse[] = [];
    const includes: ProjectResponse[] = [];

    for (const project of all) {
      const nombre = project.nombre.toLowerCase();
      if (nombre.startsWith(trimmed)) {
        startsWith.push(project);
      } else if (nombre.includes(trimmed)) {
        includes.push(project);
      }
    }

    const sortByNombre = (a: ProjectResponse, b: ProjectResponse) => a.nombre.localeCompare(b.nombre);

    return [...startsWith.sort(sortByNombre), ...includes.sort(sortByNombre)]
      .slice(0, limit)
      .map((project) => ({ project, path: this.pathFor(project) }));
  }
}
