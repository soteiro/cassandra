import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectRequest, ProjectResponse, ProjectUpdateRequest } from '../../models/proyect.model';
import { BackButtonService } from '../../services/back-button.service';
import { PronosticoService } from '../../services/pronostico.service';
import { proyectService } from '../../services/proyect.service';
import { fechaProbable, formatoFactor } from '../../utils/actividad.util';
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
  private readonly backButtonService = inject(BackButtonService);
  private readonly pronosticoService = inject(PronosticoService);
  private readonly proyectos = inject(proyectService);

  isOpen = input<boolean>(false);
  mode = input<'create' | 'edit' | 'create-subproject'>('create');
  initialData = input<ProjectResponse | null>(null);
  parentProject = input<ProjectResponse | null>(null);
  potentialParents = input<ProjectResponse[]>([]);
  isSubmitting = input<boolean>(false);

  save = output<ProjectRequest | ProjectUpdateRequest>();
  close = output<void>();

  private readonly _backBtnEffect = this.backButtonService.registerEffect(
    () => this.isOpen(),
    () => this.onClose(),
    80
  );

  // Internal form signals
  nombre = signal('');
  descripcion = signal('');
  comentario = signal('');
  por_que = signal('');
  para_que = signal('');
  criterio_finalizacion = signal('');
  premortem = signal('');
  // Retrospectiva: se pregunta al pasar el proyecto a Completado o Cancelado.
  retroParaQue = signal('');
  retroAprendizaje = signal('');
  prioridad = signal('Media');
  estado = signal('No Listado');
  fecha_limite = signal('');
  proyecto_padre_id = signal<number | null>(null);

  errorMessage = signal('');

  /**
   * Al elegir fecha límite: cuánto suelen tardar tus proyectos frente a lo que estimas,
   * y qué fecha sería con ese ritmo. null sin fecha o sin historia suficiente.
   */
  /** Al crear: cuántos proyectos tienes en marcha (para decidir si sumar otro). */
  readonly proyectosEnMarcha = computed(() => {
    if (this.mode() === 'edit') return 0;
    return (this.proyectos.proyectResource.value() ?? []).filter((p) => p.estado === 'En Proceso').length;
  });

  /** Se está cerrando el proyecto en esta edición: toca la retrospectiva. */
  readonly cerrandoProyecto = computed(() => {
    const cerrado = (e?: string) => e === 'Completado' || e === 'Cancelado';
    return this.mode() === 'edit' && cerrado(this.estado()) && !cerrado(this.initialData()?.estado);
  });

  readonly pistaFechaLimite = computed(() => {
    const plan = this.pronosticoService.planificacionResource.value();
    const fecha = this.fecha_limite();
    if (!plan?.factor || !fecha) return null;
    const inicio = this.mode() === 'edit' && this.initialData() ? new Date(this.initialData()!.fecha_creacion) : new Date();
    const limite = new Date(fecha + 'T00:00:00');
    if (plan.factor < 1.1) {
      return { texto: `Sueles cumplir tus fechas (mediana de ${plan.proyectos} proyectos).`, fecha: null };
    }
    return {
      texto: `Tus proyectos suelen tardar ${formatoFactor(plan.factor)}× lo estimado (mediana de ${plan.proyectos}). A ese ritmo terminaría cerca del`,
      fecha: fechaProbable(inicio, limite, plan.factor),
    };
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.errorMessage.set('');
        this.retroParaQue.set('');
        this.retroAprendizaje.set('');
        // Por si completaste un proyecto desde otra página desde la última vez.
        untracked(() => this.pronosticoService.planificacionResource.reload());
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
          this.premortem.set(data.premortem || '');
          this.prioridad.set(data.prioridad || 'Media');
          this.estado.set(data.estado || 'No Listado');
          this.fecha_limite.set(data.fecha_limite ? data.fecha_limite.split('T')[0] : '');
          this.proyecto_padre_id.set(data.proyecto_padre_id || null);
        } else if (m === 'create-subproject' && parent) {
          this.nombre.set('');
          this.descripcion.set('');
          this.comentario.set('');
          this.por_que.set('');
          this.para_que.set('');
          this.criterio_finalizacion.set('');
          this.premortem.set('');
          this.prioridad.set('Media');
          this.estado.set('No Listado');
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
          this.premortem.set('');
          this.prioridad.set('Media');
          this.estado.set('No Listado');
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
      premortem: this.premortem().trim(),
      prioridad: this.prioridad(),
      fecha_limite: this.fecha_limite() ? new Date(this.fecha_limite()).toISOString() : undefined,
    };

    if (this.mode() === 'edit') {
      payload.estado = this.estado();
      const cumplido = this.retroParaQue().trim();
      const aprendido = this.retroAprendizaje().trim();
      if (this.cerrandoProyecto() && (cumplido || aprendido)) {
        // No va a la API de proyectos: la página la guarda como documento del proyecto.
        payload.retrospectiva = { cumplido, aprendido };
      }
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
