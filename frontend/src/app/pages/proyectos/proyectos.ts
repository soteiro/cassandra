import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { proyectService } from '../../services/proyect.service';
import { ToastService } from '../../services/toast.service';
import { RouterLink } from '@angular/router';
import { ProjectResponse } from '../../models/proyect.model';
import {
  LucideRefreshCcw,
  LucideFolderPlus,
  LucideFolder,
  LucidePlus,
  LucideSearch,
  LucideCalendar,
  LucideTarget,
  LucideArrowRight,
  LucideSparkles,
  LucideX,
  LucideClock,
} from '@lucide/angular';

@Component({
  selector: 'app-proyectos',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideRefreshCcw,
    LucideFolderPlus,
    LucideFolder,
    LucidePlus,
    LucideSearch,
    LucideCalendar,
    LucideTarget,
    LucideArrowRight,
    LucideSparkles,
    LucideX,
    LucideClock,
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

  // Search and Filter signals
  searchQuery = signal('');
  statusFilter = signal<'all' | 'active' | 'completed' | 'critical'>('all');

  // Form signals
  nombre = signal('');
  descripcion = signal('');
  comentario = signal('');
  por_que = signal('');
  para_que = signal('');
  criterio_finalizacion = signal('');
  prioridad = signal('Media');
  fecha_limite = signal('');

  errorMessage = signal('');
  isSubmitting = signal(false);

  openModal() {
    this.errorMessage.set('');
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

  getPriorityClass(priority?: string): string {
    switch (priority) {
      case 'Critica':
        return 'bg-danger/20 text-danger border-danger/40';
      case 'Alta':
        return 'bg-amber-900/40 text-amber-300 border border-amber-800/60';
      case 'Media':
        return 'bg-blue-900/40 text-blue-300 border border-blue-800/60';
      default:
        return 'bg-surface-border/50 text-text-muted border-surface-border';
    }
  }

  getStatusClass(estado?: string): string {
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

  getFilteredProjects(proyectos: ProjectResponse[]): ProjectResponse[] {
    if (!proyectos) return [];

    let list = proyectos;
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.statusFilter();

    // Filtro por texto
    if (query) {
      list = list.filter(
        (p) =>
          p.nombre?.toLowerCase().includes(query) ||
          p.descripcion?.toLowerCase().includes(query) ||
          p.para_que?.toLowerCase().includes(query) ||
          p.criterio_finalizacion?.toLowerCase().includes(query),
      );
    }

    // Filtro por estado / prioridad
    if (filter === 'active') {
      list = list.filter((p) => p.estado !== 'Terminado' && p.estado !== 'Completado');
    } else if (filter === 'completed') {
      list = list.filter((p) => p.estado === 'Terminado' || p.estado === 'Completado');
    } else if (filter === 'critical') {
      list = list.filter((p) => p.prioridad === 'Critica' || p.prioridad === 'Alta');
    }

    return list;
  }

  getStats(proyectos: ProjectResponse[]) {
    if (!proyectos || proyectos.length === 0) {
      return { total: 0, active: 0, completed: 0, critical: 0 };
    }
    const total = proyectos.length;
    const completed = proyectos.filter(
      (p) => p.estado === 'Terminado' || p.estado === 'Completado',
    ).length;
    const active = total - completed;
    const critical = proyectos.filter(
      (p) => p.prioridad === 'Critica' || p.prioridad === 'Alta',
    ).length;
    return { total, active, completed, critical };
  }

  createProject() {
    if (!this.nombre().trim()) {
      this.errorMessage.set('El nombre del proyecto es obligatorio');
      return;
    }
    if (!this.por_que().trim()) {
      this.errorMessage.set('Debes responder: ¿Por qué nace este proyecto?');
      return;
    }
    if (!this.para_que().trim()) {
      this.errorMessage.set('Debes responder: ¿Para qué sirve / objetivo?');
      return;
    }
    if (!this.criterio_finalizacion().trim()) {
      this.errorMessage.set('Debes responder: ¿Cuándo se considera terminado?');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.proyectService
      .createProyect({
        nombre: this.nombre().trim(),
        descripcion: this.descripcion().trim(),
        comentario: this.comentario().trim(),
        por_que: this.por_que().trim(),
        para_que: this.para_que().trim(),
        criterio_finalizacion: this.criterio_finalizacion().trim(),
        prioridad: this.prioridad(),
        fecha_limite: this.fecha_limite() ? new Date(this.fecha_limite()).toISOString() : undefined,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.closeModal();
          // Reset form
          this.nombre.set('');
          this.descripcion.set('');
          this.comentario.set('');
          this.por_que.set('');
          this.para_que.set('');
          this.criterio_finalizacion.set('');
          this.prioridad.set('Media');
          this.fecha_limite.set('');

          this.reload();
          this.toastService.success('Proyecto creado correctamente');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const errorMsg = err.error?.message || err.error || 'Error al crear el proyecto';
          this.errorMessage.set(errorMsg);
          this.toastService.error(errorMsg);
        },
      });
  }
}
