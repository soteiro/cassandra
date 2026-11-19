import { LoadingDirective } from '../../../../shared/directives/loading.directive';
import {
  Component,
  DestroyRef,
  signal,
  inject,
  computed,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { TaskService } from '../../../tareas/data/task.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { getErrorMessage } from '../../../../shared/utils/http-error.util';
import { Task } from '../../../tareas/data/task.model';
import { ProjectService } from '../../../proyectos/data/project.service';
import { TaskDetailModal } from '../../../tareas/components/task-detail-modal/task-detail-modal';
import { TaskStatusSelect } from '../../../tareas/components/task-status-select/task-status-select';
import { SemanaWidget } from '../../../actividad/components/semana-widget/semana-widget';
import { TickTickWidget } from '../../../ticktick/components/ticktick-widget/ticktick-widget';
import { RevisionCard } from '../../../revision/components/revision-card/revision-card';
import {
  getTaskPriorityBadgeClass,
  getTaskPriorityBorderClass,
} from '../../../tareas/utils/task-styles.util';
import { LucideListTodo, LucideRefreshCcw, LucideCheck } from '@lucide/angular';

@Component({
  selector: 'app-home',
  imports: [
    LoadingDirective,
    CommonModule,
    FormsModule,
    RouterLink,
    TaskDetailModal,
    TaskStatusSelect,
    SemanaWidget,
    TickTickWidget,
    RevisionCard,
    LucideListTodo,
    LucideRefreshCcw,
    LucideCheck,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly projectsResource = inject(ProjectService).projectsResource;
  protected readonly proyectos = computed(() => {
    if (!this.projectsResource.hasValue()) return [];
    return [...(this.projectsResource.value() ?? [])].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    );
  });
  protected readonly selectedProjectId = linkedSignal({
    source: this.proyectos,
    computation: (proyectos, previous): number | null => {
      const id = previous?.value ?? null;
      return proyectos.some((proyecto) => proyecto.id === id) ? id : null;
    },
  });
  readonly sortedTasks = computed(() => {
    const tasks = this.tasksResource?.value() ?? [];
    const projectId = this.selectedProjectId();
    const priorityOrder = { urgente: 0, alta: 1, normal: 2, baja: 3 };

    return tasks
      .filter((task) => projectId === null || task.proyect_id === projectId)
      .sort(
        (a, b) =>
          (priorityOrder[a.prioridad?.toLowerCase() as keyof typeof priorityOrder] ?? 99) -
          (priorityOrder[b.prioridad?.toLowerCase() as keyof typeof priorityOrder] ?? 99),
      );
  });
  // Selected task for right-drawer modal
  selectedTask = signal<Task | null>(null);
  protected readonly abriendoTarea = signal(false);

  // Filter state: 'En Curso' by default
  selectedEstado = signal<string>('En Curso');
  isRotating = signal<boolean>(false);

  // Task resource
  protected readonly tasksResource = this.taskService.getAllTasks(this.selectedEstado);

  private readonly semana = viewChild(SemanaWidget);

  /** Recarga las tareas y "Esta semana" (lo terminado debe aparecer sin cambiar de semana). */
  recargarTareas() {
    this.tasksResource?.reload();
    this.semana()?.recargar();
  }

  reload() {
    this.isRotating.set(true);
    this.recargarTareas();
    this.projectsResource.reload();
    setTimeout(() => this.isRotating.set(false), 600);
  }

  setEstado(estado: string) {
    this.selectedEstado.set(estado);
  }

  protected abrirTarea(tareaId: number) {
    if (this.abriendoTarea()) return;
    this.abriendoTarea.set(true);
    this.taskService
      .getTaskById(tareaId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.abriendoTarea.set(false)),
      )
      .subscribe({
        next: (tarea) => this.selectedTask.set(tarea),
        error: (err) => this.toastService.error(getErrorMessage(err, 'No se pudo abrir la tarea')),
      });
  }

  // Actualiza el estado de forma inmutable para que los computed se recalculen.
  private setTaskEstado(id: number, estado: string) {
    this.tasksResource?.update((tasks) => tasks?.map((t) => (t.id === id ? { ...t, estado } : t)));
  }

  toggleTaskComplete(task: Task) {
    const prev = task.estado;
    const nextEstado = task.estado === 'Terminado' ? 'Abierto' : 'Terminado';
    this.setTaskEstado(task.id, nextEstado);

    this.taskService.updateTask(task.id, { estado: nextEstado }).subscribe({
      next: () => {
        if (nextEstado === 'Terminado') {
          this.toastService.success('Tarea completada');
        }
        this.recargarTareas();
      },
      error: (err) => {
        this.setTaskEstado(task.id, prev);
        this.toastService.error('Error al actualizar tarea');
        console.error('Error:', err);
      },
    });
  }

  changeTaskStatus(task: Task, nextEstado: string) {
    const prev = task.estado;
    this.setTaskEstado(task.id, nextEstado);

    this.taskService.updateTask(task.id, { estado: nextEstado }).subscribe({
      next: () => {
        this.toastService.success(`Tarea: ${nextEstado}`);
        this.recargarTareas();
      },
      error: (err) => {
        this.setTaskEstado(task.id, prev);
        this.toastService.error('Error al cambiar estado');
        console.error('Error:', err);
      },
    });
  }

  getPriorityBorderClass(prioridad?: string): string {
    return getTaskPriorityBorderClass(prioridad);
  }

  getPriorityBadgeClass(prioridad?: string): string {
    return getTaskPriorityBadgeClass(prioridad);
  }
}
