import { Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskPrioridad } from '../../models/task.model';
import {
  getTaskPriorityBadgeClass,
  SelectOptionConfig,
  TASK_PRIORITY_OPTIONS,
} from '../../utils/task-styles.util';

@Component({
  selector: 'app-task-priority-select',
  imports: [CommonModule],
  template: `
    <select
      [value]="value() || 'normal'"
      (change)="onSelectionChange($event)"
      [disabled]="disabled()"
      [name]="name()"
      [title]="title()"
      [attr.aria-label]="ariaLabel()"
      [class]="getComputedClasses()"
    >
      @for (opt of options(); track opt.value) {
        <option [value]="opt.value"
        [selected] = "opt.value === (value() || 'normal')" 
        [class]="'bg-background ' + opt.optionClass">
          {{ opt.label }}
        </option>
      }
    </select>
  `,
})
export class TaskPrioritySelect {
  value = model<string>('normal');
  size = input<'xs' | 'sm' | 'md'>('sm');
  variant = input<'badge' | 'input'>('badge');
  customClass = input<string>('');
  disabled = input<boolean>(false);
  name = input<string>('taskPrioridad');
  title = input<string>('Prioridad de la tarea');
  ariaLabel = input<string>('Prioridad de la tarea');
  options = input<SelectOptionConfig<TaskPrioridad>[]>(TASK_PRIORITY_OPTIONS);

  getComputedClasses(): string {
    const base = 'outline-none cursor-pointer transition-colors ';
    if (this.variant() === 'input') {
      return (
        base +
        'w-full bg-background border border-surface-border focus:border-primary text-text-main rounded-xl px-3 py-2.5 text-xs font-medium ' +
        this.customClass()
      );
    }

    return base + this.getSizeClass() + ' ' + this.getBadgeClass() + ' ' + this.customClass();
  }

  getBadgeClass(): string {
    return getTaskPriorityBadgeClass(this.value());
  }

  getSizeClass(): string {
    switch (this.size()) {
      case 'xs':
        return 'text-[10px] font-semibold rounded-md px-1.5 py-0.5 border';
      case 'md':
        return 'w-full rounded-xl px-3 py-2.5 text-xs font-semibold border border-surface-border';
      case 'sm':
      default:
        return 'text-xs px-2.5 py-1 rounded-lg border font-medium';
    }
  }

  onSelectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.value.set(target.value);
  }
}
