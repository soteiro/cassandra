import { LoadingDirective } from '../../../../shared/directives/loading.directive';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProjectService } from '../../data/project.service';
import { TaskService } from '../../../tareas/data/task.service';
import { NotaService } from '../../../notas/data/nota.service';
import { DocumentoService } from '../../data/documento.service';
import { ActividadService } from '../../../actividad/data/actividad.service';
import { PronosticoService } from '../../data/pronostico.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { ProjectRequest, ProjectResponse, ProjectUpdateRequest } from '../../data/project.model';
import { ProjectHeader } from '../../components/project-header/project-header';
import { SubprojectsTab } from '../../components/subprojects-tab/subprojects-tab';
import { TasksTab } from '../../components/tasks-tab/tasks-tab';
import { NotesTab } from '../../components/notes-tab/notes-tab';
import { ProjectDocuments } from '../../components/project-documents/project-documents';
import { ActivityTab } from '../../components/activity-tab/activity-tab';
import { ProjectModal } from '../../components/project-modal/project-modal';
import { ConfirmModal } from '../../../../shared/ui/confirm-modal/confirm-modal';
import {
  LucideListTodo,
  LucideFileText,
  LucideLayers,
  LucideBookOpen,
  LucideHistory,
} from '@lucide/angular';
import { getErrorMessage } from '../../../../shared/utils/http-error.util';
import { contenidoRetrospectiva, RespuestasRetrospectiva } from '../../utils/retrospectiva.util';

interface Tab {
  id: string;
  label: string;
}

@Component({
  selector: 'app-project-details',
  imports: [
    LoadingDirective,
    CommonModule,
    ProjectHeader,
    SubprojectsTab,
    TasksTab,
    NotesTab,
    ProjectDocuments,
    ActivityTab,
    ProjectModal,
    ConfirmModal,
    LucideListTodo,
    LucideFileText,
    LucideLayers,
    LucideBookOpen,
    LucideHistory,
  ],
  templateUrl: './project-details.html',
  styleUrl: './project-details.css',
})
export class ProjectDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);
  private readonly notaService = inject(NotaService);
  private readonly documentoService = inject(DocumentoService);
  private readonly actividadService = inject(ActividadService);
  private readonly pronosticoService = inject(PronosticoService);
  private readonly toast = inject(ToastService);

  private readonly paramMap = toSignal(this.route.paramMap);
  protected readonly id = () => this.paramMap()?.get('id') ?? null;
  protected readonly projectIdNumber = () => Number(this.id());

  // Resources
  protected readonly projectResource = this.projectService.getProjectById(this.id);
  protected readonly subproyectosResource = this.projectService.getSubproyectos(this.id);
  protected readonly tasksResource = this.taskService.getTasksByProyectoId(this.id);
  protected readonly notasResource = this.notaService.getNotasByProyectoId(this.id);
  protected readonly documentosResource = this.documentoService.getDocumentosByProyectoId(this.id);
  protected readonly pronosticoResource = this.pronosticoService.getPronosticoProyecto(this.id);
  protected readonly actividadLimit = signal(30);
  protected readonly actividadResource = this.actividadService.getActividadProyecto(this.id, this.actividadLimit);
  /** Si llegó el límite completo puede haber más (el backend acepta hasta 100). */
  protected readonly hayMasActividad = computed(
    () => (this.actividadResource?.value()?.length ?? 0) >= this.actividadLimit() && this.actividadLimit() < 100,
  );

  // Tabs
  tabs: Tab[] = [
    { id: 'subproyectos', label: 'Subproyectos' },
    { id: 'tareas', label: 'Tareas' },
    { id: 'notas', label: 'Notas' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'actividad', label: 'Actividad' },
  ];

  activeTab = signal<string>('tareas');

  protected readonly isViewLoading = computed(() => {
    if (this.projectResource?.isLoading()) return true;
    if (this.projectResource?.error()) return false;
    switch (this.activeTab()) {
      case 'subproyectos': return this.subproyectosResource?.isLoading() ?? false;
      case 'notas': return (this.notasResource?.isLoading() ?? false) || (this.tasksResource?.isLoading() ?? false);
      case 'documentos': return false; // Cada subpestaña gestiona su carga y sus errores.
      case 'actividad': return this.actividadResource?.isLoading() ?? false;
      default: return this.tasksResource?.isLoading() ?? false;
    }
  });

  protected readonly activeTabError = computed(() => {
    switch (this.activeTab()) {
      case 'subproyectos': return this.subproyectosResource?.error();
      case 'notas': return this.notasResource?.error() || this.tasksResource?.error();
      case 'documentos': return undefined;
      case 'actividad': return this.actividadResource?.error();
      default: return this.tasksResource?.error();
    }
  });

  protected retryActiveTab(): void {
    switch (this.activeTab()) {
      case 'subproyectos': this.subproyectosResource?.reload(); break;
      case 'notas': this.notasResource?.reload(); this.tasksResource?.reload(); break;
      case 'documentos': this.documentosResource?.reload(); break;
      case 'actividad': this.actividadResource?.reload(); break;
      default: this.tasksResource?.reload();
    }
  }

  selectedTab(tabId: string): void {
    this.activeTab.set(tabId);
    // Lo que se hizo en otras pestañas ya está en el registro: se recarga al entrar.
    if (tabId === 'actividad') this.actividadResource?.reload();
  }

  verMasActividad(): void {
    this.actividadLimit.update((l) => Math.min(l + 30, 100));
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
    const { retrospectiva, ...cambios } = payload as ProjectUpdateRequest & { retrospectiva?: RespuestasRetrospectiva };
    const proyecto = this.projectResource?.value();

    this.projectService.updateProject(this.projectIdNumber(), cambios).subscribe({
      next: () => {
        this.toast.success('Proyecto actualizado');
        if (retrospectiva && proyecto) {
          this.guardarRetrospectiva(proyecto, cambios.estado ?? proyecto.estado, retrospectiva);
        }
        this.isSubmittingEditProject.set(false);
        this.closeEditProjectModal();
        this.projectResource?.reload();
        this.pronosticoResource?.reload();
        this.pronosticoService.planificacionResource.reload();
        // La lista global de proyectos es un recurso compartido: hay que refrescarla.
        this.projectService.reload();
      },
      error: (err) => {
        this.toast.error('Error al editar el proyecto');
        this.isSubmittingEditProject.set(false);
      },
    });
  }

  /** La retrospectiva se guarda como documento del proyecto, después del cambio de estado. */
  private guardarRetrospectiva(proyecto: ProjectResponse, estado: string, respuestas: RespuestasRetrospectiva) {
    this.documentoService
      .createDocumento(proyecto.id, {
        titulo: `Retrospectiva: ${proyecto.nombre}`.slice(0, 200),
        contenido: contenidoRetrospectiva(proyecto, estado, respuestas, new Date()),
        tipo: 'retrospectiva',
      })
      .subscribe({
        next: () => this.documentosResource?.reload(),
        error: (err) => this.toast.error(getErrorMessage(err, 'El proyecto se actualizó, pero no se pudo guardar la retrospectiva')),
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
    this.projectService.deleteProject(p.id).subscribe({
      next: () => {
        this.toast.success('Proyecto eliminado');
        this.isDeletingProject.set(false);
        this.projectToDelete.set(null);
        this.projectService.reload();
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

    this.projectService.createProject(payload as ProjectRequest).subscribe({
      next: () => {
        this.toast.success('Subproyecto creado con éxito');
        this.isSubmittingSubproject.set(false);
        this.closeCreateSubprojectModal();
        this.subproyectosResource?.reload();
        this.projectResource?.reload();
        this.projectService.reload();
      },
      error: (err) => {
        this.toast.error(getErrorMessage(err, 'Error al crear el subproyecto'));
        this.isSubmittingSubproject.set(false);
      },
    });
  }

  reloadTasks() {
    this.tasksResource?.reload();
    this.pronosticoResource?.reload();
  }

  reloadNotas() {
    this.notasResource?.reload();
  }

  reloadDocumentos() {
    this.documentosResource?.reload();
  }
}
