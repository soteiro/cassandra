import { describe, it, expect } from 'vitest';
import {
  getTaskStatusBadgeClass,
  getTaskPriorityBadgeClass,
  getTaskPriorityBorderClass,
  TASK_STATUS_OPTIONS,
  TASK_PRIORITY_OPTIONS,
} from './task-styles.util';

describe('task-styles.util', () => {
  it('should return correct badge class for known task statuses', () => {
    expect(getTaskStatusBadgeClass('Abierto')).toContain('bg-background');
    expect(getTaskStatusBadgeClass('En Curso')).toContain('bg-accent/15');
    expect(getTaskStatusBadgeClass('Terminado')).toContain('bg-success/15');
    expect(getTaskStatusBadgeClass('Bloqueado')).toContain('bg-danger/15');
  });

  it('should return fallback badge class for unknown status', () => {
    expect(getTaskStatusBadgeClass('Desconocido')).toContain('bg-surface-border/50');
    expect(getTaskStatusBadgeClass(undefined)).toContain('bg-surface-border/50');
  });

  it('should return correct badge class for task priority/urgency', () => {
    expect(getTaskPriorityBadgeClass('urgente')).toContain('bg-danger/15');
    expect(getTaskPriorityBadgeClass('alta')).toContain('bg-amber-500/15');
    expect(getTaskPriorityBadgeClass('baja')).toContain('bg-surface-border/50');
    expect(getTaskPriorityBadgeClass('normal')).toContain('bg-accent/15');
  });

  it('should return correct border class for task priority', () => {
    expect(getTaskPriorityBorderClass('urgente')).toBe('border-l-4 border-l-danger');
    expect(getTaskPriorityBorderClass('urgente', true)).toBe('border-l-[3px] border-l-danger');
    expect(getTaskPriorityBorderClass('alta')).toBe('border-l-4 border-l-amber-500');
    expect(getTaskPriorityBorderClass('baja')).toBe('border-l-4 border-l-slate-400');
    expect(getTaskPriorityBorderClass('normal')).toBe('border-l-4 border-l-accent');
  });

  it('should have standard option lists defined', () => {
    expect(TASK_STATUS_OPTIONS.length).toBe(4);
    expect(TASK_PRIORITY_OPTIONS.length).toBe(4);
  });
});
