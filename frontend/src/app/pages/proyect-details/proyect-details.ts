import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { proyectService } from '../../services/proyect.service';
import { TaskService } from '../../services/task.service';
import { NotaService } from '../../services/nota.service';
import { ToastService } from '../../services/toast.service';
import { ProjectRequest, ProjectResponse, ProjectUpdateRequest } from '../../models/proyect.model';
import { ProjectHeader } from './components/project-header/project-header';
import { SubprojectsTab } from './components/subprojects-tab/subprojects-tab';
import { TasksTab } from './components/tasks-tab/tasks-tab';
import { NotesTab } from './components/notes-tab/notes-tab';
import { ProjectModal } from '../../components/project-modal/project-modal';
import { ConfirmModal } from '../../components/confirm-modal/confirm-modal';
import {
  LucideListTodo,
  LucideFileText,
  LucideLayers,
} from '@lucide/angular';

interface Tab {
  id: string;
  label: string;
}

@Component({
  selector: 'app-proyect-details',
  imports: [
    CommonModule,
    ProjectHeader,
    SubprojectsTab,
    TasksTab,
    NotesTab,
    ProjectModal,
    ConfirmModal,
    LucideListTodo,
    LucideFileText,
    LucideLayers,
  ],
  templateUrl: './proyect-details.html',
  styleUrl: './proyect-details.css',
})
export class ProyectDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly proyectService = inject(proyectService);
  private readonly taskService = inject(TaskService);
  private readonly notaService = inject(NotaService);
  private readonly toast = inject(ToastService);

  private readonly paramMap = toSignal(this.route.paramMap);
  protected readonly id = () => this.paramMap()?.get('id') ?? null;
  protected readonly projectIdNumber = () => Number(this.id());

  // Resources
  protected readonly projectResource = this.proyectService.getProyectById(this.id);
  protected readonly subproyectosResource = this.proyectService.getSubproyectos(this.id);
  protected readonly tasksResource = this.taskService.getTasksByProyectoId(this.id);
  protected readonly notasResource = this.notaService.getNotasByProyectoId(this.id);

  // Tabs
  tabs: Tab[] = [
    { id: 'subproyectos', label: 'Subproyectos' },
    { id: 'tareas', label: 'Tareas' },
    { id: 'notas', label: 'Notas' },
  ];

  activeTab = signal<string>('tareas');

  selectedTab(tabId: string): void {
    this.activeTab.set(tabId);
  }

  // --- EDIT PROJECT MODAL STATE ---
  showEditProjectModal = signal(false);
  isSubmittingEditProject = signal(false);

  openEditProjectModal() {
    this.showEditProjectProject();
  }

  showEditProjectProject() {
    this.showEditProjectModal.set(true);
  }

  closeEditProjectModal() {
    this.showEditProjectModal.set(false);
  }

  saveEditProject(payload: any) {
    this.isSubmittingEditProject.set(true);

    this.proyectService.updateProyect(this.projectIdNumber(), payload as ProjectUpdateRequest).subscribe({
      next: () => {
        this.toast.success('Proyecto actualizado');
        this.isSubmittingEditProject.set(false);
        this.closeEditProjectModal();
        this.projectResource?.reload();
      },
      error: (err) => {
        this.toast.error('Error al editar el proyecto');
        this.isSubmittingEditProject.set(false);
      },
    });
  }

  // --- DELETE PROJECT STATE ---
  projectToDelete = signal<ProjectResponse | null>(null);
  isDeletingProject = signal(false);

  openDeleteProjectModal(project: ProjectResponse) {
    this.projectToDelete.set(project);
  }

  confirmDeleteProject() {
    const p = this.projectToDelete();
    if (!p) return;

    this.isDeletingProject.set(true);
    this.proyectService.deleteProyect(p.id).subscribe({
      next: () => {
        this.toast.success('Proyecto eliminado');
        this.isDeletingProject.set(false);
        this.projectToDelete.set(null);
        this.router.navigate(['/proyectos']);
      },
      error: (err) => {
        this.toast.error('Error al borrar el proyecto');
        this.isDeletingProject.set(false);
        console.error('Error al eliminar proyecto:', err);
      },
    });
  }

  cancelDeleteProject() {
    this.projectToDelete.set(null);
  }

  // --- CREATE SUBPROJECT MODAL STATE ---
  showCreateSubprojectModal = signal(false);
  isSubmittingSubproject = signal(false);

  openCreateSubprojectModal() {
    this.showCreateSubprojectModal.set(true);
  }

  closeCreateSubprojectModal() {
    this.showCreateSubprojectModal.set(false);
  }

  saveCreateSubproject(payload: any) {
    this.isSubmittingSubproject.set(true);

    this.proyectService.createProyect(payload as ProjectRequest).subscribe({
      next: () => {
        this.toast.success('Subproyecto creado con éxito');
        this.isSubmittingSubproject.set(false);
        this.closeCreateSubprojectModal();
        this.subproyectosResource?.reload();
        this.projectResource?.reload();
      },
      error: (err) => {
        this.toast.error(err.error?.message || err.error || 'Error al crear el subproyecto');
        this.isSubmittingSubproject.set(false);
      },
    });
  }

  reloadTasks() {
    this.tasksResource?.reload();
  }

  reloadNotas() {
    this.notasResource?.reload();
  }
}
