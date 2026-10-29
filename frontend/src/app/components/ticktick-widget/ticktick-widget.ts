import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideRefreshCcw, LucideExternalLink, LucideListTodo } from '@lucide/angular';
import { TickTickService } from '../../services/ticktick.service';
import { tickTickDay, TickTickTask, TickTickToday } from '../../models/ticktick.model';

@Component({
  selector: 'app-ticktick-widget',
  imports: [DatePipe, RouterLink, LucideRefreshCcw, LucideExternalLink, LucideListTodo],
  templateUrl: './ticktick-widget.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TickTickWidget {
  private readonly service = inject(TickTickService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private day = tickTickDay();
  readonly data = signal<TickTickToday | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    this.load();
    const timer = setInterval(() => this.checkDay(), 60_000);
    const visible = () => { if (document.visibilityState === 'visible') this.checkDay(); };
    document.addEventListener('visibilitychange', visible);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      this.request?.unsubscribe();
    });
  }

  private checkDay() {
    const next = tickTickDay();
    if (next.date !== this.day.date || next.zone !== this.day.zone) this.load();
  }

  load(refresh = false) {
    const next = tickTickDay();
    if (next.date !== this.day.date || next.zone !== this.day.zone) this.data.set(null);
    this.day = next;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.service.today(next.date, next.zone, refresh).subscribe({
      next: (result) => { this.data.set(result); this.loading.set(false); },
      error: () => {
        this.data.update((value) => value?.fetched_at ? { ...value, state: 'stale' } : value);
        this.error.set(this.data()?.fetched_at
          ? 'No se pudo actualizar TickTick. Se conserva la última consulta de hoy.'
          : 'No se pudo consultar TickTick. Vuelve a intentarlo.');
        this.loading.set(false);
      },
    });
  }

  priority(task: TickTickTask) {
    return ({ 5: 'Alta', 3: 'Media', 1: 'Baja' } as Record<number, string>)[task.priority] ?? 'Sin prioridad';
  }

  dueTime(task: TickTickTask) {
    if (task.is_all_day) return 'Todo el día';
    const date = new Date(task.due_date.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es', {
      hour: '2-digit', minute: '2-digit', timeZone: this.day.zone,
    }).format(date);
  }
}
