import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { proyectService } from '../../services/proyect.service';
import { ToastService } from '../../services/toast.service';
import { ProjectRequest, ProjectResponse } from '../../models/proyect.model';
import { ProjectCard } from '../../components/project-card/project-card';
import { ProjectModal } from '../../components/project-modal/project-modal';
import {
  LucideRefreshCcw,
  LucideFolderPlus,
  LucideFolder,
  LucidePlus,
  LucideSearch,
} from '@lucide/angular';

@Component({
  selector: 'app-proyectos',
  imports: [
    CommonModule,
    FormsModule,
    ProjectCard,
    ProjectModal,
    LucideRefreshCcw,
    LucideFolderPlus,
    LucideFolder,
    LucidePlus,
    LucideSearch,
  ],
  templateUrl: './proyectos.html',
  styleUrl: './proyectos.css',
})
export class Proyectos {
  protected readonly proyectService = inject(proyectService);
  protected readonly toastService = inject(ToastService);
  protected readonly proyectsResource = this.proyectService.proyectResource;

  showModal = signal(false);
  isRotating = signal(false);
  isSubmitting = signal(false);

  // Search and Filter signals
  searchQuery = signal('');
  statusFilter = signal<'all' | 'active' | 'completed' | 'critical'>('all');

  openModal() {
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  reload() {
    this.isRotating.set(true);
    this.proyectService.reload();
    setTimeout(() => this.isRotating.set(false), 600);
  }

  potentialParents(): ProjectResponse[] {
    const list = this.proyectsResource.value() || [];
    return list.filter((p) => !p.proyecto_padre_id);
  }

  // En la vista general de proyectos, SOLO se muestran proyectos raíces/principales
  getFilteredProjects(proyectos: ProjectResponse[]): ProjectResponse[] {
    if (!proyectos) return [];

    // 1. Filtrar únicamente proyectos principales/padres (no subproyectos)
    let list = proyectos.filter((p) => !p.proyecto_padre_id);
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    // 2. Filtro de búsqueda por texto
    if (query) {
      list = list.filter(
        (p) =>
          p.nombre?.toLowerCase().includes(query) ||
          p.descripcion?.toLowerCase().includes(query) ||
          p.para_que?.toLowerCase().includes(query) ||
          p.criterio_finalizacion?.toLowerCase().includes(query),
      );
    }

    // 3. Filtro por estado / prioridad
    if (status === 'active') {
      list = list.filter((p) => p.estado !== 'Terminado' && p.estado !== 'Completado');
    } else if (status === 'completed') {
      list = list.filter((p) => p.estado === 'Terminado' || p.estado === 'Completado');
    } else if (status === 'critical') {
      list = list.filter((p) => p.prioridad === 'Critica' || p.prioridad === 'Alta');
    }

    return list;
  }

  getStats(proyectos: ProjectResponse[]) {
    if (!proyectos || proyectos.length === 0) {
      return { total: 0, active: 0, completed: 0, critical: 0 };
    }
    // Estadísticas sobre los proyectos principales
    const rootProjects = proyectos.filter((p) => !p.proyecto_padre_id);
    const total = rootProjects.length;
    const completed = rootProjects.filter(
      (p) => p.estado === 'Terminado' || p.estado === 'Completado',
    ).length;
    const active = total - completed;
    const critical = rootProjects.filter(
      (p) => p.prioridad === 'Critica' || p.prioridad === 'Alta',
    ).length;
    return { total, active, completed, critical };
  }

  handleCreateProject(payload: any) {
    this.isSubmitting.set(true);

    this.proyectService.createProyect(payload as ProjectRequest).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.reload();
        this.toastService.success('Proyecto creado correctamente');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errorMsg = err.error?.message || err.error || 'Error al crear el proyecto';
        this.toastService.error(errorMsg);
      },
    });
  }
}
