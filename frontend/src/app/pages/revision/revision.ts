import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RevisionService } from '../../services/revision.service';
import { TaskService } from '../../services/task.service';
import { proyectService } from '../../services/proyect.service';
import { ActividadService } from '../../services/actividad.service';
import { ToastService } from '../../services/toast.service';
import { SemanaWidget } from '../../components/semana-widget/semana-widget';
import { TareaEstancada } from '../../models/revision.model';
import { ProjectResponse } from '../../models/proyect.model';
import { haceCuanto, inicioDeSemana, sumarSemanas } from '../../utils/actividad.util';
import { DIAS_SEMANA } from '../../utils/revision.util';
import { getErrorMessage } from '../../utils/http-error.util';

/** Días sin cambios para que una tarea cuente como estancada. */
export const DIAS_ESTANCADA = 14;

/** Estados de proyecto que se revisan: los que están en marcha. */
const ESTADOS_ACTIVOS = new Set(['En Proceso', 'Pendiente', 'No Listado']);

type DecisionTarea = 'sigue' | 'pausa' | 'bloqueada' | 'hecha' | 'descartada';

const ACCIONES_TAREA: { decision: DecisionTarea; label: string }[] = [
  { decision: 'sigue', label: 'Sigue' },
  { decision: 'pausa', label: 'En pausa' },
  { decision: 'bloqueada', label: 'Bloqueada' },
  { decision: 'hecha', label: 'Ya está hecha' },
  { decision: 'descartada', label: 'Descartar' },
];

const ESTADO_POR_DECISION: Partial<Record<DecisionTarea, string>> = {
  pausa: 'Pendiente',
  bloqueada: 'Bloqueado',
  hecha: 'Terminado',
};

/**
 * Revisión semanal guiada: lo que hiciste, lo estancado, los proyectos activos y una
 * nota de cierre. Es un bucle de equilibrio: vacía lo que se acumula sin decidir.
 */
@Component({
  selector: 'app-revision',
  imports: [DatePipe, FormsModule, RouterLink, SemanaWidget],
  templateUrl: './revision.html',
})
export class Revision {
  private readonly revisionService = inject(RevisionService);
  private readonly taskService = inject(TaskService);
  private readonly proyectService = inject(proyectService);
  private readonly actividadService = inject(ActividadService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly pasos = ['Lo que hiciste', 'Lo estancado', 'Proyectos', 'Cierre'];
  readonly paso = signal(0);
  readonly diasSemana = DIAS_SEMANA;
  readonly acciones = ACCIONES_TAREA;
  readonly diasEstancada = DIAS_ESTANCADA;

  protected readonly preferencias = this.revisionService.preferenciasResource;
  protected readonly revisiones = this.revisionService.revisionesResource;
  protected readonly estancadasResource = this.revisionService.getEstancadas(() => DIAS_ESTANCADA);
  private readonly lunes = inicioDeSemana(new Date());
  protected readonly semana = this.actividadService.getResumen(() => ({
    desde: this.lunes,
    hasta: sumarSemanas(this.lunes, 1),
  }));

  /** Decisiones tomadas en esta revisión (por id de tarea / proyecto). */
  readonly decisionesTareas = signal<Record<number, DecisionTarea>>({});
  readonly decisionesProyectos = signal<Record<number, 'sigue' | 'pausado'>>({});
  readonly procesando = signal<number | null>(null);
  readonly nota = signal('');
  readonly guardando = signal(false);
  readonly mostrarAnteriores = signal(false);

  readonly pendientes = computed(() =>
    (this.estancadasResource?.value() ?? []).filter((t) => !this.decisionesTareas()[t.id]),
  );

  readonly proyectosActivos = computed(() =>
    (this.proyectService.proyectResource.value() ?? []).filter((p) => ESTADOS_ACTIVOS.has(p.estado)),
  );

  siguiente(): void {
    this.paso.update((p) => Math.min(p + 1, this.pasos.length - 1));
  }

  anterior(): void {
    this.paso.update((p) => Math.max(p - 1, 0));
  }

  cambiarDia(dia: number): void {
    this.revisionService.actualizarPreferencias({ dia_revision: Number(dia) }).subscribe({
      next: () => this.preferencias.reload(),
      error: (err) => this.toast.error(getErrorMessage(err, 'No se pudo guardar el día')),
    });
  }

  decidirTarea(t: TareaEstancada, decision: DecisionTarea): void {
    if (decision === 'sigue') {
      this.marcarTarea(t.id, decision);
      return;
    }
    this.procesando.set(t.id);
    const peticion: Observable<unknown> =
      decision === 'descartada'
        ? this.taskService.deleteTask(t.id)
        : this.taskService.updateTask(t.id, { estado: ESTADO_POR_DECISION[decision] });
    peticion.subscribe({
      next: () => {
        this.procesando.set(null);
        this.marcarTarea(t.id, decision);
      },
      error: (err) => {
        this.procesando.set(null);
        this.toast.error(getErrorMessage(err, 'No se pudo actualizar la tarea'));
      },
    });
  }

  /** Las que quedan sin decidir pasan a pausa: dejar de cargarlas sin borrarlas. */
  pausarTodas(): void {
    for (const t of this.pendientes()) {
      this.decidirTarea(t, 'pausa');
    }
  }

  private marcarTarea(id: number, decision: DecisionTarea): void {
    this.decisionesTareas.update((d) => ({ ...d, [id]: decision }));
  }

  decidirProyecto(p: ProjectResponse, decision: 'sigue' | 'pausado'): void {
    if (decision === 'sigue') {
      this.decisionesProyectos.update((d) => ({ ...d, [p.id]: decision }));
      return;
    }
    this.procesando.set(p.id);
    this.proyectService.updateProyect(p.id, { estado: 'Pausado' }).subscribe({
      next: () => {
        this.procesando.set(null);
        this.decisionesProyectos.update((d) => ({ ...d, [p.id]: decision }));
      },
      error: (err) => {
        this.procesando.set(null);
        this.toast.error(getErrorMessage(err, 'No se pudo pausar el proyecto'));
      },
    });
  }

  /** Números de esta revisión, para verlas a lo largo del tiempo. */
  readonly resumen = computed(() => {
    const decisiones: Record<string, number> = {};
    for (const d of Object.values(this.decisionesTareas())) {
      decisiones[d] = (decisiones[d] ?? 0) + 1;
    }
    const proyectos = Object.values(this.decisionesProyectos());
    const s = this.semana?.value();
    return {
      terminadas: s?.flujo.terminadas ?? 0,
      creadas: s?.flujo.creadas ?? 0,
      estancadas: this.estancadasResource?.value()?.length ?? 0,
      decisiones,
      proyectos_revisados: proyectos.length,
      proyectos_pausados: proyectos.filter((d) => d === 'pausado').length,
    };
  });

  guardar(): void {
    this.guardando.set(true);
    this.revisionService.crearRevision(this.nota().trim(), this.resumen()).subscribe({
      next: () => {
        this.guardando.set(false);
        this.toast.success('Revisión guardada');
        this.revisiones.reload();
        this.proyectService.reload();
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.guardando.set(false);
        this.toast.error(getErrorMessage(err, 'No se pudo guardar la revisión'));
      },
    });
  }

  haceCuanto(fecha?: string): string {
    return haceCuanto(fecha);
  }

  etiquetaDecision(d: string): string {
    return ACCIONES_TAREA.find((a) => a.decision === d)?.label.toLowerCase() ?? d;
  }

  decisionesTexto(decisiones?: Record<string, number>): string {
    return Object.entries(decisiones ?? {})
      .map(([d, n]) => `${n} ${this.etiquetaDecision(d)}`)
      .join(' · ');
  }
}
