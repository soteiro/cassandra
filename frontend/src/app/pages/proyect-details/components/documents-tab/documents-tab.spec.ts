import type { Mock } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { DocumentsTab } from './documents-tab';
import { DocumentoProyecto } from '../../../../models/documento.model';
import { DocumentoService } from '../../../../services/documento.service';
import { ToastService } from '../../../../services/toast.service';

const makeDoc = (overrides: Partial<DocumentoProyecto> = {}): DocumentoProyecto => ({
  id: 1,
  proyecto_id: 7,
  user_id: 1,
  titulo: 'Doc',
  contenido: '# Hola',
  tipo: 'general',
  fecha_creacion: '2026-01-01T00:00:00Z',
  fecha_actualizacion: '2026-01-01T00:00:00Z',
  eliminado: false,
  ...overrides,
});

describe('DocumentsTab', () => {
  let component: DocumentsTab;
  let fixture: ComponentFixture<DocumentsTab>;
  let el: HTMLElement;
  let documentoService: {
    createDocumento: Mock;
    updateDocumento: Mock;
    deleteDocumento: Mock;
  };
  let toast: { success: Mock; error: Mock; info: Mock };
  let reloadSpy: Mock<(value?: unknown) => void>;

  beforeEach(async () => {
    documentoService = {
      createDocumento: vi.fn(),
      updateDocumento: vi.fn(),
      deleteDocumento: vi.fn().mockReturnValue(of({})),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [DocumentsTab],
      providers: [
        provideRouter([]),
        { provide: DocumentoService, useValue: documentoService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentsTab);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.componentRef.setInput('projectId', 7);
    reloadSpy = vi.fn();
    component.reload.subscribe(reloadSpy);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  describe('list mode rendering', () => {
    it('should show loading state', async () => {
      fixture.componentRef.setInput('isLoading', true);
      await render();
      expect(el.textContent).toContain('Cargando documentos...');
    });

    it('should show empty state and start creation from its button', async () => {
      await render();
      expect(el.textContent).toContain('Aún no hay documentos en este proyecto');
      const btn = Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Crear'),
      ) as HTMLButtonElement;
      expect(btn).toBeTruthy();
      btn.click();
      expect(component.activeMode()).toBe('editor');
    });

    it('should show "no results" message when filters exclude everything', async () => {
      fixture.componentRef.setInput('documentos', [makeDoc()]);
      component.searchQuery.set('zzz');
      await render();
      expect(el.textContent).toContain('No se encontraron documentos');
    });

    it('should render document cards and open detail on click', async () => {
      fixture.componentRef.setInput('documentos', [makeDoc({ id: 3, titulo: 'Arquitectura X', tipo: 'arquitectura' })]);
      await render();
      expect(el.textContent).toContain('Arquitectura X');
      const card = Array.from(el.querySelectorAll('div.cursor-pointer')).find((d) =>
        d.textContent?.includes('Arquitectura X'),
      ) as HTMLElement;
      card.click();
      expect(component.activeMode()).toBe('detail');
      expect(component.selectedDoc()?.id).toBe(3);
    });
  });

  describe('filteredDocs', () => {
    const docs = [
      makeDoc({ id: 1, titulo: 'Caching', tipo: 'arquitectura', contenido: 'redis' }),
      makeDoc({ id: 2, titulo: 'Guía deploy', tipo: 'guia', contenido: 'podman', tags: 'docker, go' }),
      makeDoc({ id: 3, titulo: 'Idea loca', tipo: 'idea', contenido: 'nada' }),
    ];
    const ids = () => component.filteredDocs().map((d) => d.id);

    beforeEach(() => fixture.componentRef.setInput('documentos', docs));

    it('should return all docs by default', () => {
      expect(ids()).toEqual([1, 2, 3]);
    });

    it('should filter by category', () => {
      component.filterTipo.set('guia');
      expect(ids()).toEqual([2]);
    });

    it('should search in title, content and tags', () => {
      component.searchQuery.set('CACHING');
      expect(ids()).toEqual([1]);
      component.searchQuery.set('podman');
      expect(ids()).toEqual([2]);
      component.searchQuery.set(' docker ');
      expect(ids()).toEqual([2]);
    });

    it('should combine category and search', () => {
      component.filterTipo.set('idea');
      component.searchQuery.set('redis');
      expect(ids()).toEqual([]);
    });
  });

  describe('markdown previews', () => {
    it('should render editor and detail previews from markdown', () => {
      component.editorContenido.set('# Titulo');
      expect(component.editorPreviewHtml()).toContain('Titulo');
      expect(component.detailPreviewHtml()).toBe('');
      component.openDetail(makeDoc({ contenido: '**negrita**' }));
      expect(component.detailPreviewHtml()).toContain('negrita');
    });
  });

  it('getCategoryMeta should return known categories and fall back for unknown ones', () => {
    expect(component.getCategoryMeta('decision').label).toBe('Decisión');
    const fallback = component.getCategoryMeta('raro');
    expect(fallback.id).toBe('general');
    expect(fallback.label).toBe('raro');
  });

  describe('navigation', () => {
    it('startCreate should reset the editor', () => {
      component.editorTitulo.set('x');
      component.isEditing.set(true);
      component.startCreate();
      expect(component.isEditing()).toBe(false);
      expect(component.editorTitulo()).toBe('');
      expect(component.editorTipo()).toBe('general');
      expect(component.activeMode()).toBe('editor');
    });

    it('startEdit should load the doc and stop event propagation', () => {
      const event = new MouseEvent('click');
      const stop = vi.spyOn(event, 'stopPropagation');
      component.startEdit(makeDoc({ id: 4, titulo: 'T', tipo: 'idea', tags: 'a,b' }), event);
      expect(stop).toHaveBeenCalled();
      expect(component.isEditing()).toBe(true);
      expect(component.editorDocId()).toBe(4);
      expect(component.editorTipo()).toBe('idea');
      expect(component.editorTags()).toBe('a,b');
      expect(component.activeMode()).toBe('editor');
    });

    it('backToList should return to list mode', () => {
      component.openDetail(makeDoc());
      component.backToList();
      expect(component.activeMode()).toBe('list');
    });

    it('should render the editor when in editor mode', async () => {
      component.startCreate();
      await render();
      expect(el.querySelector('textarea')).toBeTruthy();
    });
  });

  describe('saveDocument', () => {
    it('should not get stuck saving when editing without a document id', () => {
      component.startCreate();
      component.editorTitulo.set('Doc');
      component.isEditing.set(true);
      component.editorDocId.set(null);
      component.saveDocument();
      expect(toast.error).toHaveBeenCalledWith('No se encontró el documento a editar');
      expect(component.isSaving()).toBe(false);
    });

    it('should require a title', () => {
      component.startCreate();
      component.editorTitulo.set('   ');
      component.saveDocument();
      expect(toast.error).toHaveBeenCalledWith('El título del documento es obligatorio');
      expect(documentoService.createDocumento).not.toHaveBeenCalled();
      expect(component.isSaving()).toBe(false);
    });

    it('should create a new document and show it in detail', () => {
      const created = makeDoc({ id: 10 });
      documentoService.createDocumento.mockReturnValue(of(created));
      component.startCreate();
      component.editorTitulo.set(' Nuevo ');
      component.editorContenido.set('cuerpo');
      component.editorTags.set('   ');
      component.saveDocument();

      expect(documentoService.createDocumento).toHaveBeenCalledWith(7, {
        proyecto_id: 7,
        titulo: 'Nuevo',
        tipo: 'general',
        contenido: 'cuerpo',
        tags: undefined,
      });
      expect(component.selectedDoc()).toBe(created);
      expect(component.activeMode()).toBe('detail');
      expect(component.isSaving()).toBe(false);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should update an existing document', () => {
      const updated = makeDoc({ id: 4, titulo: 'Editado' });
      documentoService.updateDocumento.mockReturnValue(of(updated));
      component.startEdit(makeDoc({ id: 4 }));
      component.editorTitulo.set('Editado');
      component.editorTags.set(' x ');
      component.saveDocument();

      expect(documentoService.updateDocumento).toHaveBeenCalledWith(4, {
        titulo: 'Editado',
        tipo: 'general',
        contenido: '# Hola',
        tags: 'x',
      });
      expect(component.selectedDoc()).toBe(updated);
      expect(component.activeMode()).toBe('detail');
    });

    it('should stay in editor on create/update errors', () => {
      documentoService.createDocumento.mockReturnValue(throwError(() => new Error('x')));
      component.startCreate();
      component.editorTitulo.set('T');
      component.saveDocument();
      expect(toast.error).toHaveBeenCalledWith('Error al crear el documento');
      expect(component.activeMode()).toBe('editor');
      expect(component.isSaving()).toBe(false);

      documentoService.updateDocumento.mockReturnValue(throwError(() => new Error('x')));
      component.startEdit(makeDoc());
      component.saveDocument();
      expect(toast.error).toHaveBeenCalledWith('Error al actualizar el documento');
      expect(component.isSaving()).toBe(false);
    });
  });

  describe('delete flow', () => {
    it('should prompt and cancel', () => {
      const doc = makeDoc();
      component.promptDelete(doc);
      expect(component.docToDelete()).toBe(doc);
      component.cancelDelete();
      expect(component.docToDelete()).toBeNull();
    });

    it('should do nothing on confirm without a target', () => {
      component.confirmDelete();
      expect(documentoService.deleteDocumento).not.toHaveBeenCalled();
    });

    it('should go back to list if the deleted doc was open', () => {
      const doc = makeDoc({ id: 5 });
      component.openDetail(doc);
      component.promptDelete(doc);
      component.confirmDelete();
      expect(documentoService.deleteDocumento).toHaveBeenCalledWith(5);
      expect(component.selectedDoc()).toBeNull();
      expect(component.activeMode()).toBe('list');
      expect(component.docToDelete()).toBeNull();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should keep the current detail if another doc was deleted', () => {
      component.openDetail(makeDoc({ id: 5 }));
      component.promptDelete(makeDoc({ id: 6 }));
      component.confirmDelete();
      expect(component.selectedDoc()?.id).toBe(5);
      expect(component.activeMode()).toBe('detail');
    });

    it('should keep the modal open on error', () => {
      documentoService.deleteDocumento.mockReturnValue(throwError(() => new Error('x')));
      component.promptDelete(makeDoc());
      component.confirmDelete();
      expect(component.docToDelete()).not.toBeNull();
      expect(component.isDeleting()).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Error al eliminar el documento');
    });
  });

  describe('copyMarkdown', () => {
    it('should copy and reset the flag after 2s', async () => {
      vi.useFakeTimers();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      component.copyMarkdown(makeDoc({ id: 2, contenido: 'md' }));
      await Promise.resolve();
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith('md');
      expect(component.copiedDocId()).toBe(2);
      vi.advanceTimersByTime(2000);
      expect(component.copiedDocId()).toBeNull();
    });

    it('should toast an error if the clipboard fails', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      component.copyMarkdown(makeDoc());
      await new Promise((r) => setTimeout(r, 0));
      expect(toast.error).toHaveBeenCalledWith('No se pudo copiar al portapapeles');
    });
  });

  describe('insertSnippet', () => {
    it('should append the snippet when no textarea is available', () => {
      component.editorContenido.set('abc');
      component.insertSnippet('**', '**', 'texto');
      expect(component.editorContenido()).toBe('abc**texto**');
    });

    it('should wrap the current selection when the textarea exists', async () => {
      component.startCreate();
      component.editorContenido.set('hola mundo');
      await render();
      const textarea = component.markdownTextarea!.nativeElement;
      textarea.setSelectionRange(5, 10);
      component.insertSnippet('**', '**', 'x');
      expect(component.editorContenido()).toBe('hola **mundo**');
    });
  });
});
