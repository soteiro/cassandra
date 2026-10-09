import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideCalendarCheck, LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { ActividadService } from '../../services/actividad.service';
import { TareaTerminada } from '../../models/actividad.model';
import { inicioDeSemana, sumarSemanas } from '../../utils/actividad.util';

interface GrupoProyecto {
  proyectoId: number;
  proyectoNombre: string;
  tareas: TareaTerminada[];
}

/** "Lo que hiciste": lo terminado en una semana, el flujo de tareas y otra actividad. */
@Component({
  selector: 'app-semana-widget',
  imports: [DatePipe, RouterLink, LucideCalendarCheck, LucideChevronLeft, LucideChevronRight],
  templateUrl: './semana-widget.html',
})
export class SemanaWidget {
  private readonly actividadService = inject(ActividadService);
  private readonly semanaActual = inicioDeSemana(new Date());

  readonly desde = signal(this.semanaActual);
  readonly hasta = computed(() => sumarSemanas(this.desde(), 1));
  readonly esSemanaActual = computed(() => this.desde().getTime() >= this.semanaActual.getTime());
  /** Domingo de la semana mostrada (para la etiqueta). */
  readonly domingo = computed(() => new Date(this.hasta().getTime() - 1));

  protected readonly resumen = this.actividadService.getResumen(() => ({
    desde: this.desde(),
    hasta: this.hasta(),
  }));

  readonly porProyecto = computed<GrupoProyecto[]>(() => {
    const grupos = new Map<number, GrupoProyecto>();
    for (const t of this.resumen?.value()?.tareas_terminadas ?? []) {
      let g = grupos.get(t.proyecto_id);
      if (!g) {
        g = { proyectoId: t.proyecto_id, proyectoNombre: t.proyecto_nombre, tareas: [] };
        grupos.set(t.proyecto_id, g);
      }
      g.tareas.push(t);
    }
    return [...grupos.values()];
  });

  /** Lo que no es trabajo, solo lo que ocurrió («2 interacciones con 1 persona»). */
  readonly otros = computed<string[]>(() => {
    const o = this.resumen?.value()?.otros;
    if (!o) return [];
    const partes: string[] = [];
    if (o.interacciones) {
      partes.push(
        `${plural(o.interacciones, 'interacción', 'interacciones')} con ${plural(o.personas_contactadas, 'persona', 'personas')}`,
      );
    }
    if (o.reflexiones) partes.push(plural(o.reflexiones, 'reflexión', 'reflexiones'));
    if (o.notas) partes.push(plural(o.notas, 'nota', 'notas'));
    return partes;
  });

  /** El inicio lo llama al cambiar una tarea, para que lo terminado aparezca al tiro. */
  recargar(): void {
    this.resumen?.reload();
  }

  anterior(): void {
    this.desde.update((d) => sumarSemanas(d, -1));
  }

  siguiente(): void {
    if (!this.esSemanaActual()) this.desde.update((d) => sumarSemanas(d, 1));
  }
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
