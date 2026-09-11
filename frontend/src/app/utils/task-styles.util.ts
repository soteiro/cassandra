import { TaskPrioridad } from '../models/task.model';

export type TaskStatus = 'Abierto' | 'En Curso' | 'Terminado' | 'Bloqueado';

export interface SelectOptionConfig<T = string> {
  value: T;
  label: string;
  badgeClass: string;
  optionClass: string;
}

export const TASK_STATUS_OPTIONS: SelectOptionConfig<TaskStatus>[] = [
  {
    value: 'Abierto',
    label: 'Abierto',
    badgeClass: 'bg-background text-text-muted border-surface-border/50',
    optionClass: 'text-text-main',
  },
  {
    value: 'En Curso',
    label: 'En Curso',
    badgeClass: 'bg-accent/15 text-accent border-accent/30',
    optionClass: 'text-accent',
  },
  {
    value: 'Terminado',
    label: 'Terminado',
    badgeClass: 'bg-success/15 text-success border-success/30',
    optionClass: 'text-success',
  },
  {
    value: 'Bloqueado',
    label: 'Bloqueado',
    badgeClass: 'bg-danger/15 text-danger border-danger/30',
    optionClass: 'text-danger',
  },
];

export const TASK_PRIORITY_OPTIONS: SelectOptionConfig<TaskPrioridad>[] = [
  {
    value: 'baja',
    label: 'Baja',
    badgeClass: 'bg-surface-border/50 text-text-muted border-surface-border',
    optionClass: 'text-text-muted',
  },
  {
    value: 'normal',
    label: 'Normal',
    badgeClass: 'bg-accent/15 text-accent border-accent/30',
    optionClass: 'text-accent',
  },
  {
    value: 'alta',
    label: 'Alta',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    optionClass: 'text-amber-400',
  },
  {
    value: 'urgente',
    label: 'Urgente',
    badgeClass: 'bg-danger/15 text-danger border-danger/30',
    optionClass: 'text-danger',
  },
];

export function getTaskStatusBadgeClass(estado?: string): string {
  switch (estado) {
    case 'Terminado':
    case 'Completado':
      return 'bg-success/15 text-success border-success/30';
    case 'En Curso':
    case 'En Proceso':
      return 'bg-accent/15 text-accent border-accent/30';
    case 'Bloqueado':
    case 'Pausado':
      return 'bg-danger/15 text-danger border-danger/30';
    case 'Abierto':
      return 'bg-background text-text-muted border-surface-border/50';
    default:
      return 'bg-surface-border/50 text-text-muted border-surface-border';
  }
}

export function getTaskPriorityBadgeClass(prioridad?: string): string {
  switch (prioridad?.toLowerCase()) {
    case 'urgente':
      return 'bg-danger/15 text-danger border-danger/30';
    case 'alta':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'baja':
      return 'bg-surface-border/50 text-text-muted border-surface-border';
    case 'normal':
    default:
      return 'bg-accent/15 text-accent border-accent/30';
  }
}

export function getTaskPriorityBorderClass(prioridad?: string, isSubtask = false): string {
  const width = isSubtask ? 'border-l-[3px]' : 'border-l-4';
  switch (prioridad?.toLowerCase()) {
    case 'urgente':
      return `${width} border-l-danger`;
    case 'alta':
      return `${width} border-l-amber-500`;
    case 'baja':
      return `${width} border-l-slate-400`;
    case 'normal':
    default:
      return `${width} border-l-accent`;
  }
}
