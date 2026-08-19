import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { proyectService } from '../../services/proyect.service';
import { TaskService } from '../../services/task.service';
import { NotaService } from '../../services/nota.service';
import { Task } from '../../models/task.model';
import { ProjectResponse } from '../../models/proyect.model';
import { NotaProyecto } from '../../models/nota.model';
import { ToastService } from '../../services/toast.service'
import { ConfirmModal } from '../../components/confirm-modal/confirm-modal';
import {
  LucideChevronDown,
  LucideChevronRight,
  LucidePlus,
  LucideTrash2,
  LucideCheck,
  LucideListTodo,
  LucideCheckCheck,
  LucideCornerDownRight,
  LucidePencil,
  LucideX,
  LucideMessageCircleMore,
  LucideFileText,
  LucideCopy,
  LucideSearch,
  LucideClock
} from '@lucide/angular';

interface Tab {
  id: string;
  label: string;
}

@Component({
  selector: 'app-proyect-details',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ConfirmModal,
    LucideChevronDown,
    LucideChevronRight,
    LucidePlus,
    LucideTrash2,
    LucideCheck,
    LucideListTodo,
    LucideCheckCheck,
    LucideCornerDownRight,
    LucidePencil,
    LucideX,
    LucideMessageCircleMore,
    LucideFileText,
    LucideCopy,
    LucideSearch,
    LucideClock
  ],
  templateUrl: './proyect-details.html',
  styleUrl: './proyect-details.css',
})
export class ProyectDetails {
  tabs: Tab[] = [
    { id: 'tareas', label: 'Tareas' },
    { id: 'notas', label: 'Notas' },
  ];

  activeTab = signal<string>('tareas');
  showProjectContext = signal<boolean>(false);

  toggleProjectContext() {
    this.showProjectContext.update((v) => !v);
  }
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ProyectService = inject(proyectService);
  private readonly taskService = inject(TaskService);
  private readonly notaService = inject(NotaService);
  private readonly Toast = inject(ToastService);

  private readonly id = () => this.route.snapshot.paramMap.get('id');
  protected readonly projectIdNumber = () => Number(this.id());

  protected readonly projectResource = this.ProyectService.getProyectById(this.id);
  protected readonly tasksResource = this.taskService.getTasksByProyectoId(this.id);
  protected readonly notasResource = this.notaService.getNotasByProyectoId(this.id);

  // Tab switching
  selectedTab(tabId: string): void {
    this.activeTab.set(tabId);
  }

  // --- PROJECT EDIT & DELETE STATE ---
  showEditProjectModal = signal(false);
  editNombre = signal('');
  editDescripcion = signal('');
  editComentario = signal('');
  editPorQue = signal('');
  editParaQue = signal('');
  editCriterioFinalizacion = signal('');
  editPrioridad = signal('Media');
  editEstado = signal('En Curso');
  editFechaLimite = signal('');
  isSubmittingEditProject = signal(false);
  editProjectErrorMessage = signal('');

  projectToDelete = signal<ProjectResponse | null>(null);
  isDeletingProject = signal(false);

  openEditProjectModal(project: ProjectResponse) {
    this.editNombre.set(project.nombre || '');
    this.editDescripcion.set(project.descripcion || '');
    this.editComentario.set(project.comentario || '');
    this.editPorQue.set(project.por_que || '');
    this.editParaQue.set(project.para_que || '');
    this.editCriterioFinalizacion.set(project.criterio_finalizacion || '');
    this.editPrioridad.set(project.prioridad || 'Media');
    this.editEstado.set(project.estado || 'En Curso');
    this.editFechaLimite.set(
      project.fecha_limite ? project.fecha_limite.split('T')[0] : '',
    );
    this.editProjectErrorMessage.set('');
    this.showEditProjectModal.set(true);
  }

  closeEditProjectModal() {
    this.showEditProjectModal.set(false);
  }

  saveEditProject() {
    if (!this.editNombre().trim()) {
      this.editProjectErrorMessage.set('El nombre del proyecto es obligatorio');
      return;
    }
    if (!this.editPorQue().trim()) {
      this.editProjectErrorMessage.set('Debes responder: ¿Por qué nace este proyecto?');
      return;
    }
    if (!this.editParaQue().trim()) {
      this.editProjectErrorMessage.set('Debes responder: ¿Para qué sirve / objetivo?');
      return;
    }
    if (!this.editCriterioFinalizacion().trim()) {
      this.editProjectErrorMessage.set('Debes responder: ¿Cuándo se considera terminado?');
      return;
    }

    this.isSubmittingEditProject.set(true);
    this.editProjectErrorMessage.set('');

    this.ProyectService.updateProyect(this.projectIdNumber(), {
      nombre: this.editNombre().trim(),
      descripcion: this.editDescripcion().trim(),
      comentario: this.editComentario().trim(),
      por_que: this.editPorQue().trim(),
      para_que: this.editParaQue().trim(),
      criterio_finalizacion: this.editCriterioFinalizacion().trim(),
      prioridad: this.editPrioridad(),
      estado: this.editEstado(),
      fecha_limite: this.editFechaLimite()
        ? new Date(this.editFechaLimite()).toISOString()
        : undefined,
    }).subscribe({
      next: () => {
        this.Toast.success("Proyecto actualizado")
        this.isSubmittingEditProject.set(false);
        this.closeEditProjectModal();
        this.projectResource?.reload();
      },
      error: (err) => {
        this.Toast.error("Error al editar el proyecto")
        this.isSubmittingEditProject.set(false);
        this.editProjectErrorMessage.set(err.error || 'Error al actualizar el proyecto');
      },
    });
  }

  openDeleteProjectModal(project: ProjectResponse) {
    this.projectToDelete.set(project);
  }

  confirmDeleteProject() {
    const p = this.projectToDelete();
    if (!p) return;

    this.isDeletingProject.set(true);
    this.ProyectService.deleteProyect(p.id).subscribe({
      next: () => {
        this.Toast.success("Proyecto eliminado")
        this.isDeletingProject.set(false);
        this.projectToDelete.set(null);
        this.router.navigate(['/proyectos']);
      },
      error: (err) => {
        this.Toast.error("Error al borrar el proyecto")
        this.isDeletingProject.set(false);
        console.error('Error al eliminar proyecto:', err);
      },
    });
  }

  cancelDeleteProject() {
    this.projectToDelete.set(null);
  }

  // --- TASKS STATE ---
  expandedTasks = signal<Set<number>>(new Set());
  quickTaskTitle = signal('');
  quickComment = signal('');
  isSubmittingQuickTask = signal(false);
  quickSubtaskInputs = signal<Record<number, string>>({});
  isSubmittingSubtask = signal<Record<number, boolean>>({});
  taskFilter = signal<'all' | 'pending' | 'completed' | 'en_curso' | 'bloqueado' | 'abierto'>('pending');

  taskToDelete = signal<{ id: number; nombre: string; isSubtask: boolean } | null>(null);
  isDeletingTask = signal(false);

  toggleExpand(taskId: number) {
    const next = new Set(this.expandedTasks());
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    this.expandedTasks.set(next);
  }

  isExpanded(taskId: number): boolean {
    return this.expandedTasks().has(taskId);
  }

  expandTask(taskId: number) {
    if (!this.expandedTasks().has(taskId)) {
      const next = new Set(this.expandedTasks());
      next.add(taskId);
      this.expandedTasks.set(next);
    }
  }

  getSubtaskInput(taskId: number): string {
    return this.quickSubtaskInputs()[taskId] || '';
  }

  setSubtaskInput(taskId: number, value: string) {
    this.quickSubtaskInputs.update((prev) => ({ ...prev, [taskId]: value }));
  }

  // 1-Click Toggle completion on parent task (Optimistic update)
  toggleTaskComplete(task: Task) {
    const prev = task.estado;
    const nextEstado = task.estado === 'Terminado' ? 'Abierto' : 'Terminado';
    task.estado = nextEstado;

    this.taskService.updateTask(task.id, { estado: nextEstado }).subscribe({
      next: () => {
        if (prev === 'Abierto' || prev === 'En Curso' || prev === 'Bloqueado') {
          this.Toast.success("Tarea Completada")
        }
        this.tasksResource?.reload()
      },
      error: (err) => {
        this.Toast.error("Ha ocurrido un error")
        task.estado = prev;
        console.error('Error al cambiar estado de tarea:', err);
      },
    });
  }

  // 1-Click Toggle completion on subtask (Optimistic update)
  toggleSubtaskComplete(subtask: Task) {
    const prev = subtask.estado;
    const nextEstado = subtask.estado === 'Terminado' ? 'Abierto' : 'Terminado';
    subtask.estado = nextEstado;

    this.taskService.updateTask(subtask.id, { estado: nextEstado }).subscribe({
      next: () => {
        if (prev === 'Abierto' || prev === 'En Curso' || prev === 'Bloqueado') {
          this.Toast.success("Tarea Completada")
        }
        this.tasksResource?.reload()
      },
      error: (err) => {
        this.Toast.error("Ha ocurrido un error")
        subtask.estado = prev;
        console.error('Error al cambiar estado de subtarea:', err);
      },
    });
  }

  changeTaskStatus(task: Task, nextEstado: string) {
    const prev = task.estado;
    task.estado = nextEstado;

    this.taskService.updateTask(task.id, { estado: nextEstado }).subscribe({
      next: () => this.tasksResource?.reload(),
      error: (err) => {
        task.estado = prev;
        console.error('Error al actualizar estado de tarea:', err);
      },
    });
  }

  // Create top-level task inline (Zero friction)
  createQuickTask() {
    const title = this.quickTaskTitle().trim();
    const comment = this.quickComment().trim();
    const proyectId = this.projectIdNumber();
    if (!title || !proyectId) return;

    this.isSubmittingQuickTask.set(true);

    this.taskService
      .createTask({
        nombre: title,
        descripcion: '',
        comentario: comment,
        estado: 'Abierto',
        proyect_id: proyectId,
      })
      .subscribe({
        next: () => {
          this.Toast.success("Tarea Creada")
          this.quickTaskTitle.set('');
          this.quickComment.set('');
          this.isSubmittingQuickTask.set(false);
          this.tasksResource?.reload();
        },
        error: (err) => {
          this.Toast.error("Ocurrio un error")
          console.error('Error al crear tarea rápida:', err);
          this.isSubmittingQuickTask.set(false);
        },
      });
  }

  // Create subtask inline (Zero friction)
  createInlineSubtask(parentTaskId: number) {
    const title = this.getSubtaskInput(parentTaskId).trim();
    const proyectId = this.projectIdNumber();
    if (!title || !proyectId) return;

    this.isSubmittingSubtask.update((prev) => ({ ...prev, [parentTaskId]: true }));

    this.taskService
      .createTask({
        nombre: title,
        descripcion: '',
        comentario: '',
        estado: 'Abierto',
        proyect_id: proyectId,
        tarea_padre_id: parentTaskId,
      })
      .subscribe({
        next: () => {
          this.setSubtaskInput(parentTaskId, '');
          this.isSubmittingSubtask.update((prev) => ({ ...prev, [parentTaskId]: false }));
          this.expandTask(parentTaskId);
          this.Toast.success("Tarea Creada")
          this.tasksResource?.reload();
        },
        error: (err) => {
          this.Toast.error("Ocurrio un error")
          console.error('Error al crear subtarea inline:', err);
          this.isSubmittingSubtask.update((prev) => ({ ...prev, [parentTaskId]: false }));
        },
      });
  }

  // Modal Deletion Flow for Tasks
  requestDeleteTask(task: Task, isSubtask = false) {
    this.taskToDelete.set({ id: task.id, nombre: task.nombre, isSubtask });
  }

  confirmDeleteTask() {
    const target = this.taskToDelete();
    if (!target) return;

    this.isDeletingTask.set(true);
    this.taskService.deleteTask(target.id).subscribe({
      next: () => {
        this.isDeletingTask.set(false);
        this.taskToDelete.set(null);
        this.Toast.success("Tarea Eliminada")
        this.tasksResource?.reload();
      },
      error: (err) => {
        this.isDeletingTask.set(false);
        this.Toast.error("Ocurrio un error")
        console.error('Error al eliminar tarea:', err);
      },
    });
  }

  cancelDeleteTask() {
    this.taskToDelete.set(null);
  }

  // Helper metrics
  getSubtaskStats(task: Task) {
    const subs = task.subtareas || [];
    const total = subs.length;
    const completed = subs.filter((s) => s.estado === 'Terminado').length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percent };
  }

  getTaskCountByStatus(tareas: Task[], status: string): number {
    if (!tareas) return 0;
    return tareas.filter((t) => (t.estado || 'Abierto').toLowerCase() === status.toLowerCase()).length;
  }

  private getTaskStatusWeight(estado?: string): number {
    switch (estado?.trim()) {
      case 'En Curso':
      case 'en curso':
      case 'En curso':
        return 1;
      case 'Bloqueado':
      case 'bloqueado':
      case 'Bloqueada':
        return 2;
      case 'Abierto':
      case 'abierto':
      case 'Abierta':
        return 3;
      case 'Terminado':
      case 'terminado':
      case 'Terminada':
      case 'Completado':
        return 4;
      default:
        return 5;
    }
  }

  getFilteredTasks(tareas: Task[]): Task[] {
    const filter = this.taskFilter();
    let filtered = tareas;

    if (filter === 'pending') {
      filtered = tareas.filter((t) => t.estado !== 'Terminado' && t.estado !== 'Completado');
    } else if (filter === 'completed') {
      filtered = tareas.filter((t) => t.estado === 'Terminado' || t.estado === 'Completado');
    } else if (filter === 'en_curso') {
      filtered = tareas.filter((t) => (t.estado || '').toLowerCase() === 'en curso');
    } else if (filter === 'bloqueado') {
      filtered = tareas.filter((t) => (t.estado || '').toLowerCase() === 'bloqueado');
    } else if (filter === 'abierto') {
      filtered = tareas.filter((t) => (t.estado || 'Abierto').toLowerCase() === 'abierto');
    }

    return [...filtered].sort((a, b) => {
      const weightA = this.getTaskStatusWeight(a.estado);
      const weightB = this.getTaskStatusWeight(b.estado);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.id - b.id;
    });
  }

  getSortedSubtasks(subtareas?: Task[]): Task[] {
    if (!subtareas || subtareas.length === 0) return [];
    return [...subtareas].sort((a, b) => {
      const weightA = this.getTaskStatusWeight(a.estado);
      const weightB = this.getTaskStatusWeight(b.estado);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.id - b.id;
    });
  }

  getOverallStats(tareas: Task[]) {
    if (!tareas || tareas.length === 0) return { total: 0, completed: 0, percent: 0 };
    const total = tareas.length;
    const completed = tareas.filter((t) => t.estado === 'Terminado' || t.estado === 'Completado').length;
    const percent = Math.round((completed / total) * 100);
    return { total, completed, percent };
  }

  getPriorityClass(priority?: string): string {
    switch (priority) {
      case 'Critica':
        return 'bg-danger/20 text-danger border border-danger/40';
      case 'Alta':
        return 'bg-amber-900/40 text-amber-300 border border-amber-800/60';
      case 'Media':
        return 'bg-blue-900/40 text-blue-300 border border-blue-800/60';
      default:
        return 'bg-surface text-text-muted border border-surface-border';
    }
  }

  getTaskStatusClass(estado?: string): string {
    switch (estado) {
      case 'Terminado':
        return 'bg-success/15 text-success border-success/30';
      case 'En Curso':
        return 'bg-accent/15 text-accent border-accent/30';
      case 'Bloqueado':
        return 'bg-danger/15 text-danger border-danger/30';
      default:
        return 'bg-surface-border/50 text-text-muted border-surface-border';
    }
  }

  getProjectStatusClass(estado?: string): string {
    switch (estado) {
      case 'Terminado':
      case 'Completado':
        return 'bg-success/20 text-success border-success/40';
      case 'En Curso':
      case 'Activo':
        return 'bg-accent/20 text-accent border-accent/40';
      case 'Bloqueado':
      case 'Pausado':
        return 'bg-danger/20 text-danger border-danger/40';
      default:
        return 'bg-surface-border/50 text-text-muted border-surface-border';
    }
  }

  // --- NOTAS STATE & METHODS ---
  newNotaText = signal('');
  isSubmittingNota = signal(false);

  editingNotaId = signal<number | null>(null);
  editingNotaText = signal('');
  isUpdatingNota = signal(false);

  notaToDelete = signal<NotaProyecto | null>(null);
  isDeletingNota = signal(false);

  notaSearchQuery = signal('');
  copiedNotaId = signal<number | null>(null);

  createNota() {
    const text = this.newNotaText().trim();
    const proyectoId = this.projectIdNumber();
    if (!text || !proyectoId) return;

    this.isSubmittingNota.set(true);
    this.notaService.createNota(proyectoId, { nota: text }).subscribe({
      next: () => {
        this.Toast.success('Nota guardada');
        this.newNotaText.set('');
        this.isSubmittingNota.set(false);
        this.notasResource?.reload();
      },
      error: (err) => {
        this.Toast.error('Error al guardar la nota');
        console.error('Error al crear nota:', err);
        this.isSubmittingNota.set(false);
      },
    });
  }

  startEditNota(nota: NotaProyecto) {
    this.editingNotaId.set(nota.id);
    this.editingNotaText.set(nota.nota);
  }

  cancelEditNota() {
    this.editingNotaId.set(null);
    this.editingNotaText.set('');
  }

  saveEditNota(nota: NotaProyecto) {
    const text = this.editingNotaText().trim();
    if (!text) {
      this.Toast.error('La nota no puede estar vacía');
      return;
    }

    this.isUpdatingNota.set(true);
    this.notaService.updateNota(nota.id, { nota: text }).subscribe({
      next: () => {
        this.Toast.success('Nota actualizada');
        this.cancelEditNota();
        this.isUpdatingNota.set(false);
        this.notasResource?.reload();
      },
      error: (err) => {
        this.Toast.error('Error al actualizar la nota');
        console.error('Error al actualizar nota:', err);
        this.isUpdatingNota.set(false);
      },
    });
  }

  openDeleteNotaModal(nota: NotaProyecto) {
    this.notaToDelete.set(nota);
  }

  confirmDeleteNota() {
    const nota = this.notaToDelete();
    if (!nota) return;

    this.isDeletingNota.set(true);
    this.notaService.deleteNota(nota.id).subscribe({
      next: () => {
        this.Toast.success('Nota eliminada');
        this.isDeletingNota.set(false);
        this.notaToDelete.set(null);
        this.notasResource?.reload();
      },
      error: (err) => {
        this.Toast.error('Error al eliminar la nota');
        console.error('Error al eliminar nota:', err);
        this.isDeletingNota.set(false);
      },
    });
  }

  cancelDeleteNota() {
    this.notaToDelete.set(null);
  }

  getFilteredNotas(notas: NotaProyecto[]): NotaProyecto[] {
    const query = this.notaSearchQuery().toLowerCase().trim();
    if (!query) return notas;
    return notas.filter((n) => n.nota.toLowerCase().includes(query));
  }

  copyNotaContent(nota: NotaProyecto) {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(nota.nota).then(() => {
      this.copiedNotaId.set(nota.id);
      this.Toast.success('Nota copiada al portapapeles');
      setTimeout(() => {
        if (this.copiedNotaId() === nota.id) {
          this.copiedNotaId.set(null);
        }
      }, 2000);
    });
  }
}

