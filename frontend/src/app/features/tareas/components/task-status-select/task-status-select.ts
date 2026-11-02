import { Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  getTaskStatusBadgeClass,
  SelectOptionConfig,
  TASK_STATUS_OPTIONS,
  TaskStatus,
} from '../../utils/task-styles.util';

@Component({
  selector: 'app-task-status-select',
  imports: [CommonModule],
  template: `
    <select
      [value]="value() || 'Abierto'"
      (change)="onSelectionChange($event)"
      [disabled]="disabled()"
      [name]="name()"
      [title]="title()"
      [attr.aria-label]="ariaLabel()"
      [class]="getComputedClasses()"
    >
      @for (opt of options(); track opt.value) {
        <option
          [value]="opt.value"
          [selected]="opt.value === (value() || 'Abierto')"
          [class]="'bg-background ' + opt.optionClass"
        >
          {{ opt.label }}
        </option>
      }
    </select>
  `,
})
export class TaskStatusSelect {
  value = model<string>('Abierto');
  size = input<'xs' | 'sm' | 'md'>('sm');
  variant = input<'badge' | 'input'>('badge');
  customClass = input<string>('');
  disabled = input<boolean>(false);
  name = input<string>('taskEstado');
  title = input<string>('Estado de la tarea');
  ariaLabel = input<string>('Estado de la tarea');
  options = input<SelectOptionConfig<TaskStatus>[]>(TASK_STATUS_OPTIONS);

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
    return getTaskStatusBadgeClass(this.value());
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
