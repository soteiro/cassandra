import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentoService } from '../../../../services/documento.service';
import { ToastService } from '../../../../services/toast.service';
import {
  DocumentoProyecto,
  DocumentoTipo,
} from '../../../../models/documento.model';
import { parseMarkdown } from '../../../../utils/markdown.util';
import { ConfirmModal } from '../../../../components/confirm-modal/confirm-modal';
import {
  LucideBookOpen,
  LucideFileText,
  LucideSearch,
  LucideX,
  LucidePlus,
  LucidePencil,
  LucideTrash2,
  LucideArrowLeft,
  LucideCopy,
  LucideCheck,
  LucideEye,
  LucideCode,
  LucideTag,
  LucideCalendar,
  LucideBrain,
  LucideSparkles,
} from '@lucide/angular';

export interface CategoryMeta {
  id: DocumentoTipo;
  label: string;
  badgeClass: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'arquitectura',
    label: 'Arquitectura',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  {
    id: 'investigacion',
    label: 'Investigación',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  },
  {
    id: 'decision',
    label: 'Decisión',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  {
    id: 'guia',
    label: 'Guía',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'idea',
    label: 'Idea',
    badgeClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  },
  {
    id: 'pajas mentales',
    label: 'Pajas Mentales',
    badgeClass: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30',
  },
  {
    id: 'general',
    label: 'General',
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  },
];

@Component({
  selector: 'app-documents-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConfirmModal,
    LucideBookOpen,
    LucideFileText,
    LucideSearch,
    LucideX,
    LucidePlus,
    LucidePencil,
    LucideTrash2,
    LucideArrowLeft,
    LucideCopy,
    LucideCheck,
    LucideEye,
    LucideCode,
    LucideTag,
    LucideCalendar,
    LucideBrain,
    LucideSparkles,
  ],
  templateUrl: './documents-tab.html',
})
export class DocumentsTab {
  @ViewChild('markdownTextarea') markdownTextarea?: ElementRef<HTMLTextAreaElement>;

  projectId = input.required<number>();
  documentos = input<DocumentoProyecto[]>([]);
  isLoading = input<boolean>(false);

  reload = output<void>();

  private readonly documentoService = inject(DocumentoService);
  private readonly toastService = inject(ToastService);

  readonly categories = CATEGORIES;

  // Modos de visualización en la misma página:
  // 'list': listado de documentos con filtros y buscador
  // 'detail': lectura completa del documento seleccionado
  // 'editor': creación o edición de documento con toggle escribir / vista previa
  activeMode = signal<'list' | 'detail' | 'editor'>('list');
  selectedDoc = signal<DocumentoProyecto | null>(null);

  // Filtros
  filterTipo = signal<string>('todas');
  searchQuery = signal<string>('');

  // Estado del editor
  isEditing = signal<boolean>(false);
  editorDocId = signal<number | null>(null);
  editorTitulo = signal<string>('');
  editorTipo = signal<DocumentoTipo>('general');
  editorContenido = signal<string>('');
  editorTags = signal<string>('');
  editorTab = signal<'write' | 'preview' | 'split'>('write');
  isSaving = signal<boolean>(false);

  // Eliminación
  docToDelete = signal<DocumentoProyecto | null>(null);
  isDeleting = signal<boolean>(false);

  // Copiado
  copiedDocId = signal<number | null>(null);

  // Documentos filtrados
  filteredDocs = computed(() => {
    const docs = this.documentos() || [];
    const filter = this.filterTipo();
    const query = this.searchQuery().trim().toLowerCase();

    return docs.filter((doc) => {
      // Filtro por tipo/categoría
      if (filter !== 'todas' && doc.tipo !== filter) {
        return false;
      }
      // Filtro por búsqueda de texto
      if (query) {
        const matchTitulo = doc.titulo.toLowerCase().includes(query);
        const matchContenido = doc.contenido.toLowerCase().includes(query);
        const matchTags = doc.tags ? doc.tags.toLowerCase().includes(query) : false;
        return matchTitulo || matchContenido || matchTags;
      }
      return true;
    });
  });

  // Vista previa en el editor
  editorPreviewHtml = computed(() => {
    return parseMarkdown(this.editorContenido());
  });

  // Vista renderizada del documento seleccionado en modo lectura
  detailPreviewHtml = computed(() => {
    const doc = this.selectedDoc();
    return doc ? parseMarkdown(doc.contenido) : '';
  });

  getCategoryMeta(tipo: string): CategoryMeta {
    return (
      this.categories.find((c) => c.id === tipo) || {
        id: 'general',
        label: tipo,
        badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      }
    );
  }

  // --- NAVEGACIÓN Y ACCIONES ---

  startCreate() {
    this.isEditing.set(false);
    this.editorDocId.set(null);
    this.editorTitulo.set('');
    this.editorTipo.set('general');
    this.editorContenido.set('');
    this.editorTags.set('');
    this.editorTab.set('write');
    this.activeMode.set('editor');
  }

  startEdit(doc: DocumentoProyecto, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.isEditing.set(true);
    this.editorDocId.set(doc.id);
    this.editorTitulo.set(doc.titulo);
    this.editorTipo.set(doc.tipo);
    this.editorContenido.set(doc.contenido);
    this.editorTags.set(doc.tags || '');
    this.editorTab.set('write');
    this.activeMode.set('editor');
  }

  openDetail(doc: DocumentoProyecto) {
    this.selectedDoc.set(doc);
    this.activeMode.set('detail');
  }

  backToList() {
    this.activeMode.set('list');
  }

  saveDocument() {
    const titulo = this.editorTitulo().trim();
    if (!titulo) {
      this.toastService.error('El título del documento es obligatorio');
      return;
    }

    const contenido = this.editorContenido();
    const tipo = this.editorTipo();
    const tags = this.editorTags().trim() || undefined;
    const pId = this.projectId();

    this.isSaving.set(true);

    if (this.isEditing()) {
      const docId = this.editorDocId();
      if (!docId) return;

      this.documentoService
        .updateDocumento(docId, {
          titulo,
          tipo,
          contenido,
          tags,
        })
        .subscribe({
          next: (updated) => {
            this.toastService.success('Documento actualizado');
            this.isSaving.set(false);
            this.selectedDoc.set(updated);
            this.activeMode.set('detail');
            this.reload.emit();
          },
          error: (err) => {
            console.error('Error al actualizar documento:', err);
            this.toastService.error('Error al actualizar el documento');
            this.isSaving.set(false);
          },
        });
    } else {
      this.documentoService
        .createDocumento(pId, {
          proyecto_id: pId,
          titulo,
          tipo,
          contenido,
          tags,
        })
        .subscribe({
          next: (created) => {
            this.toastService.success('Documento creado con éxito');
            this.isSaving.set(false);
            this.selectedDoc.set(created);
            this.activeMode.set('detail');
            this.reload.emit();
          },
          error: (err) => {
            console.error('Error al crear documento:', err);
            this.toastService.error('Error al crear el documento');
            this.isSaving.set(false);
          },
        });
    }
  }

  copyMarkdown(doc: DocumentoProyecto, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    navigator.clipboard
      .writeText(doc.contenido)
      .then(() => {
        this.copiedDocId.set(doc.id);
        this.toastService.success('Markdown copiado al portapapeles');
        setTimeout(() => {
          if (this.copiedDocId() === doc.id) {
            this.copiedDocId.set(null);
          }
        }, 2000);
      })
      .catch(() => {
        this.toastService.error('No se pudo copiar al portapapeles');
      });
  }

  promptDelete(doc: DocumentoProyecto, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.docToDelete.set(doc);
  }

  cancelDelete() {
    this.docToDelete.set(null);
  }

  confirmDelete() {
    const doc = this.docToDelete();
    if (!doc) return;

    this.isDeleting.set(true);
    this.documentoService.deleteDocumento(doc.id).subscribe({
      next: () => {
        this.toastService.success('Documento eliminado');
        this.isDeleting.set(false);
        this.docToDelete.set(null);
        if (this.selectedDoc()?.id === doc.id) {
          this.selectedDoc.set(null);
          this.activeMode.set('list');
        }
        this.reload.emit();
      },
      error: (err) => {
        console.error('Error al eliminar documento:', err);
        this.toastService.error('Error al eliminar el documento');
        this.isDeleting.set(false);
      },
    });
  }

  // --- HELPERS DE INSERCIÓN RÁPIDA EN EL TEXTAREA ---
  insertSnippet(before: string, after: string = '', defaultText: string = '') {
    const textarea = this.markdownTextarea?.nativeElement;
    const current = this.editorContenido();

    if (!textarea) {
      this.editorContenido.set(current + before + defaultText + after);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = current.substring(start, end) || defaultText;
    const replacement = before + selected + after;

    const newContent = current.substring(0, start) + replacement + current.substring(end);
    this.editorContenido.set(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length
      );
    }, 0);
  }
}
