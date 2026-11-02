import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DocumentoProyecto } from '../../data/documento.model';
import { DocumentsTab } from '../documents-tab/documents-tab';
import { ProjectLogsTab } from '../project-logs-tab/project-logs-tab';

@Component({
  selector: 'app-project-documents',
  imports: [DocumentsTab, ProjectLogsTab],
  templateUrl: './project-documents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDocuments {
  projectId = input.required<number>();
  documentos = input<DocumentoProyecto[]>([]);
  isLoading = input(false);
  hasError = input(false);
  reload = output<void>();
  protected readonly section = signal<'documentos' | 'logs'>('documentos');
  protected readonly logsVisited = signal(false);

  protected select(section: 'documentos' | 'logs'): void {
    this.section.set(section);
    if (section === 'logs') this.logsVisited.set(true);
  }

  protected navigate(event: Event, target: 'documentos' | 'logs', button: HTMLButtonElement): void {
    event.preventDefault();
    this.select(target);
    button.focus();
  }
}
