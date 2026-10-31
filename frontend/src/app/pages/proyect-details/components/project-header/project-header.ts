import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectResponse } from '../../../../models/proyect.model';
import { PronosticoProyecto } from '../../../../models/pronostico.model';
import {
  LucideCornerDownRight,
  LucideLayers,
  LucidePencil,
  LucideTrash2,
  LucideTarget,
  LucideChevronDown,
} from '@lucide/angular';
import { haceCuanto } from '../../../../shared/utils/fecha.util';
import { rangoSemanas } from '../../../../utils/pronostico.util';

// Preferencia de este navegador: el propósito se muestra plegado salvo que lo abras.
const CLAVE_PROPOSITO = 'cassandra.proyecto.mostrarProposito';

@Component({
  selector: 'app-project-header',
  imports: [
    CommonModule,
    RouterLink,
    LucideCornerDownRight,
    LucideLayers,
    LucidePencil,
    LucideTrash2,
    LucideTarget,
    LucideChevronDown,
  ],
  templateUrl: './project-header.html',
})
export class ProjectHeader {
  project = input.required<ProjectResponse>();
  pronostico = input<PronosticoProyecto | null | undefined>(null);

  edit = output<void>();
  delete = output<void>();

  readonly tieneProposito = computed(() => {
    const p = this.project();
    return !!(p.por_que || p.para_que || p.premortem || p.descripcion || p.comentario);
  });
  readonly mostrarProposito = signal(leerPreferencia());

  alternarProposito(): void {
    this.mostrarProposito.update((v) => !v);
    try {
      localStorage.setItem(CLAVE_PROPOSITO, String(this.mostrarProposito()));
    } catch {
      // Sin almacenamiento (modo privado): la preferencia dura lo que la página.
    }
  }

  /**
   * "Al ritmo actual, entre 3 y 6 semanas" y si se pasa de la fecha límite. Sin datos
   * suficientes no hay texto: mejor callar que inventar.
   */
  readonly textoPronostico = computed(() => {
    const p = this.pronostico();
    if (p?.semanas_min == null || p.semanas_max == null) return null;
    let texto = `Al ritmo actual, ${rangoSemanas(p.semanas_min, p.semanas_max)} para las ${p.tareas_abiertas} tareas abiertas`;
    const limite = this.project().fecha_limite;
    if (limite) {
      const finProbable = new Date();
      finProbable.setDate(finProbable.getDate() + p.semanas_max * 7);
      if (finProbable > new Date(limite)) texto += ' (la fecha límite cae antes)';
    }
    return texto;
  });

  haceCuanto(fecha?: string): string {
    return haceCuanto(fecha);
  }

  getPriorityClass(priority?: string): string {
    switch (priority) {
      case 'Critica':
        return 'bg-danger/20 text-danger border border-danger/40';
      case 'Alta':
        return 'bg-warning-surface/40 text-warning-emphasis border border-warning-border/60';
      case 'Media':
        return 'bg-info-surface/40 text-info-emphasis border border-info-border/60';
      default:
        return 'bg-surface-border/50 text-text-muted border border-surface-border';
    }
  }

  getStatusClass(estado?: string): string {
    switch (estado) {
      case 'Completado':
      case 'Terminado':
        return 'bg-success/20 text-success border border-success/40';
      case 'En Proceso':
      case 'En Curso':
      case 'Activo':
        return 'bg-accent/20 text-accent border border-accent/40';
      case 'Pausado':
      case 'Bloqueado':
        return 'bg-warning-surface/40 text-warning-emphasis border border-warning-border/60';
      case 'Cancelado':
        return 'bg-danger/20 text-danger border border-danger/40';
      case 'Idea':
        return 'bg-insight-surface/40 text-insight-emphasis border border-insight-border/60';
      case 'Pendiente':
      case 'No Listado':
      default:
        return 'bg-surface-border/50 text-text-muted border border-surface-border';
    }
  }
}

function leerPreferencia(): boolean {
  try {
    return localStorage.getItem(CLAVE_PROPOSITO) === 'true';
  } catch {
    return false;
  }
}
