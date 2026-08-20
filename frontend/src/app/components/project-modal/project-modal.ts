import { Component, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectRequest, ProjectResponse, ProjectUpdateRequest } from '../../models/proyect.model';
import {
  LucideSparkles,
  LucidePencil,
  LucideLayers,
  LucideX,
} from '@lucide/angular';

@Component({
  selector: 'app-project-modal',
  imports: [
    CommonModule,
    FormsModule,
    LucideSparkles,
    LucidePencil,
    LucideLayers,
    LucideX,
  ],
  templateUrl: './project-modal.html',
})
export class ProjectModal {
  isOpen = input<boolean>(false);
  mode = input<'create' | 'edit' | 'create-subproject'>('create');
  initialData = input<ProjectResponse | null>(null);
  parentProject = input<ProjectResponse | null>(null);
  potentialParents = input<ProjectResponse[]>([]);
  isSubmitting = input<boolean>(false);

  save = output<ProjectRequest | ProjectUpdateRequest>();
  close = output<void>();

  // Internal form signals
  nombre = signal('');
  descripcion = signal('');
  comentario = signal('');
  por_que = signal('');
  para_que = signal('');
  criterio_finalizacion = signal('');
  prioridad = signal('Media');
  estado = signal('En Curso');
  fecha_limite = signal('');
  proyecto_padre_id = signal<number | null>(null);

  errorMessage = signal('');

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.errorMessage.set('');
        const data = this.initialData();
        const parent = this.parentProject();
        const m = this.mode();

        if (m === 'edit' && data) {
          this.nombre.set(data.nombre || '');
          this.descripcion.set(data.descripcion || '');
          this.comentario.set(data.comentario || '');
          this.por_que.set(data.por_que || '');
          this.para_que.set(data.para_que || '');
          this.criterio_finalizacion.set(data.criterio_finalizacion || '');
          this.prioridad.set(data.prioridad || 'Media');
          this.estado.set(data.estado || 'En Curso');
          this.fecha_limite.set(data.fecha_limite ? data.fecha_limite.split('T')[0] : '');
          this.proyecto_padre_id.set(data.proyecto_padre_id || null);
        } else if (m === 'create-subproject' && parent) {
          this.nombre.set('');
          this.descripcion.set('');
          this.comentario.set('');
          this.por_que.set('');
          this.para_que.set('');
          this.criterio_finalizacion.set('');
          this.prioridad.set('Media');
          this.estado.set('En Curso');
          this.fecha_limite.set('');
          this.proyecto_padre_id.set(parent.id);
        } else {
          // create mode
          this.nombre.set('');
          this.descripcion.set('');
          this.comentario.set('');
          this.por_que.set('');
          this.para_que.set('');
          this.criterio_finalizacion.set('');
          this.prioridad.set('Media');
          this.estado.set('En Curso');
          this.fecha_limite.set('');
          this.proyecto_padre_id.set(null);
        }
      }
    });
  }

  onSubmit() {
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

    const payload: any = {
      nombre: this.nombre().trim(),
      descripcion: this.descripcion().trim(),
      comentario: this.comentario().trim(),
      por_que: this.por_que().trim(),
      para_que: this.para_que().trim(),
      criterio_finalizacion: this.criterio_finalizacion().trim(),
      prioridad: this.prioridad(),
      fecha_limite: this.fecha_limite() ? new Date(this.fecha_limite()).toISOString() : undefined,
    };

    if (this.mode() === 'edit') {
      payload.estado = this.estado();
    }

    if (this.mode() === 'create' || this.mode() === 'create-subproject') {
      payload.proyecto_padre_id = this.proyecto_padre_id() ? Number(this.proyecto_padre_id()) : undefined;
    }

    this.save.emit(payload);
  }

  onClose() {
    this.close.emit();
  }
}
