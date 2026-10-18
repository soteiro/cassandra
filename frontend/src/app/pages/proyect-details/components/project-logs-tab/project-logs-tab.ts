import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect,
  ElementRef, inject, input, signal, viewChild, viewChildren,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ProjectLog } from '../../../../models/project-log.model';
import { LOG_PAGE_SIZE, ProjectLogService } from '../../../../services/project-log.service';
import { parseMarkdown } from '../../../../utils/markdown.util';
import { MermaidDirective } from '../../../../directives/mermaid.directive';

@Component({
  selector: 'app-project-logs-tab',
  imports: [DatePipe, MermaidDirective],
  templateUrl: './project-logs-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectLogsTab {
  projectId = input.required<number>();
  protected readonly query = signal('');
  protected readonly offset = signal(0);
  protected readonly selected = signal<ProjectLog | null>(null);
  protected readonly copyStatus = signal('');
  protected readonly copying = signal(false);
  protected readonly resource = inject(ProjectLogService).getByProyectoId(this.projectId, this.query, this.offset);
  protected readonly logs = computed(() => this.resource.error() ? [] : (this.resource.value() ?? []).slice(0, LOG_PAGE_SIZE));
  protected readonly hasMore = computed(() => !this.resource.error() && (this.resource.value()?.length ?? 0) > LOG_PAGE_SIZE && this.offset() + LOG_PAGE_SIZE <= 10000);
  protected readonly html = computed(() => parseMarkdown(this.selected()?.contenido_raw ?? ''));
  private readonly detailTitle = viewChild<ElementRef<HTMLHeadingElement>>('detailTitle');
  private readonly logButtons = viewChildren<ElementRef<HTMLButtonElement>>('logButton');
  private readonly lastSelected = signal<number | null>(null);
  private readonly restoreFocus = signal(false);

  constructor() {
    effect(() => {
      this.projectId();
      this.query.set('');
      this.offset.set(0);
      this.selected.set(null);
      this.copyStatus.set('');
    });
    afterRenderEffect(() => this.detailTitle()?.nativeElement.focus());
    afterRenderEffect(() => {
      if (this.restoreFocus() && !this.selected()) {
        this.logButtons().find(button => button.nativeElement.dataset['logId'] === String(this.lastSelected()))?.nativeElement.focus();
      }
    });
  }

  protected search(query: string): void {
    this.query.set(query);
    this.offset.set(0);
    this.restoreFocus.set(false);
  }

  protected page(direction: -1 | 1): void {
    this.restoreFocus.set(false);
    this.offset.update(offset => Math.max(0, offset + direction * LOG_PAGE_SIZE));
  }

  protected open(log: ProjectLog): void {
    this.restoreFocus.set(false);
    this.lastSelected.set(log.id);
    this.copyStatus.set('');
    this.selected.set(log);
  }

  protected back(): void {
    this.selected.set(null);
    this.copyStatus.set('');
    this.restoreFocus.set(true);
  }

  protected async copy(log: ProjectLog): Promise<void> {
    if (this.copying()) return;
    this.copying.set(true);
    try {
      await navigator.clipboard.writeText(log.contenido_raw);
      if (this.selected()?.id === log.id) this.copyStatus.set('Markdown copiado.');
    } catch {
      if (this.selected()?.id === log.id) this.copyStatus.set('No se pudo copiar al portapapeles. Intenta de nuevo.');
    } finally {
      this.copying.set(false);
    }
  }
}
