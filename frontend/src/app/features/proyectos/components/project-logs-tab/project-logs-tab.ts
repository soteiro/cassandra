import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideChevronRight } from '@lucide/angular';
import { ProjectLog } from '../../data/project-log.model';
import { LOG_PAGE_SIZE, ProjectLogService } from '../../data/project-log.service';
import { parseMarkdown } from '../../../../shared/utils/markdown.util';
import { MermaidDirective } from '../../../../shared/directives/mermaid.directive';

/**
 * Bitácora del proyecto. Cada entrada se despliega en la misma lista (<details>), así no hay
 * que entrar a otra vista y volver.
 */
@Component({
  selector: 'app-project-logs-tab',
  imports: [DatePipe, MermaidDirective, LucideChevronRight],
  templateUrl: './project-logs-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectLogsTab {
  projectId = input.required<number>();
  protected readonly query = signal('');
  protected readonly offset = signal(0);
  /** Entradas desplegadas: solo de ellas se renderiza el Markdown. */
  protected readonly abiertos = signal<ReadonlySet<number>>(new Set());
  protected readonly copyStatus = signal<{ id: number; texto: string } | null>(null);
  protected readonly copying = signal(false);
  protected readonly resource = inject(ProjectLogService).getByProyectoId(
    this.projectId,
    this.query,
    this.offset,
  );
  protected readonly logs = computed(() =>
    this.resource.error() ? [] : (this.resource.value() ?? []).slice(0, LOG_PAGE_SIZE),
  );
  protected readonly hasMore = computed(
    () =>
      !this.resource.error() &&
      (this.resource.value()?.length ?? 0) > LOG_PAGE_SIZE &&
      this.offset() + LOG_PAGE_SIZE <= 10000,
  );
  protected readonly htmls = computed(() => {
    const abiertos = this.abiertos();
    return new Map(
      this.logs()
        .filter((log) => abiertos.has(log.id))
        .map((log) => [log.id, parseMarkdown(log.contenido_raw)]),
    );
  });

  constructor() {
    effect(() => {
      this.projectId();
      this.query.set('');
      this.offset.set(0);
      this.cerrarTodo();
    });
  }

  protected search(query: string): void {
    this.query.set(query);
    this.offset.set(0);
    this.cerrarTodo();
  }

  protected page(direction: -1 | 1): void {
    this.offset.update((offset) => Math.max(0, offset + direction * LOG_PAGE_SIZE));
    this.cerrarTodo();
  }

  protected alternar(id: number, abierto: boolean): void {
    if (this.abiertos().has(id) === abierto) return;
    this.abiertos.update((actual) => {
      const siguiente = new Set(actual);
      if (abierto) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
    if (!abierto && this.copyStatus()?.id === id) this.copyStatus.set(null);
  }

  protected async copy(log: ProjectLog): Promise<void> {
    if (this.copying()) return;
    this.copying.set(true);
    try {
      await navigator.clipboard.writeText(log.contenido_raw);
      this.copyStatus.set({ id: log.id, texto: 'Markdown copiado.' });
    } catch {
      this.copyStatus.set({
        id: log.id,
        texto: 'No se pudo copiar al portapapeles. Intenta de nuevo.',
      });
    } finally {
      this.copying.set(false);
    }
  }

  private cerrarTodo(): void {
    this.abiertos.set(new Set());
    this.copyStatus.set(null);
  }
}
