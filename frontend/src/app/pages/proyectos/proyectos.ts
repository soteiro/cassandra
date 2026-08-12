import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { proyectService } from '../../services/proyect.service';
import { RouterLink } from '@angular/router';
import { LucideRefreshCcw, LucideFolderPlus } from '@lucide/angular'
 
@Component({
  selector: 'app-proyectos',
  imports: [CommonModule, FormsModule, RouterLink, LucideRefreshCcw, LucideFolderPlus],
  templateUrl: './proyectos.html',
  styleUrl: './proyectos.css',
})
export class Proyectos {
  protected readonly proyectService = inject(proyectService);
  protected readonly proyectsResource = this.proyectService.proyectResource;

  showModal = signal(false);

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
    this.proyectService.reload();
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'Critica':
        return 'bg-red-900/40 text-red-400 border border-red-800';
      case 'Alta':
        return 'bg-orange-900/40 text-orange-400 border border-orange-800';
      case 'Media':
        return 'bg-amber-900/40 text-amber-400 border border-amber-800';
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
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

    this.proyectService.createProyect({
      nombre: this.nombre().trim(),
      descripcion: this.descripcion().trim(),
      comentario: this.comentario().trim(),
      por_que: this.por_que().trim(),
      para_que: this.para_que().trim(),
      criterio_finalizacion: this.criterio_finalizacion().trim(),
      prioridad: this.prioridad(),
      fecha_limite: this.fecha_limite() ? new Date(this.fecha_limite()).toISOString() : undefined,
    }).subscribe({
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
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error || 'Error al crear el proyecto');
      }
    });
  }
}
