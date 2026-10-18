import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ProjectDocuments } from './project-documents';
import { DocumentoService } from '../../../../services/documento.service';
import { ProjectLogService } from '../../../../services/project-log.service';

describe('ProjectDocuments', () => {
  let fixture: ComponentFixture<ProjectDocuments>;
  let el: HTMLElement;
  const getLogs = vi.fn().mockReturnValue({ value: signal([]), isLoading: signal(false), error: signal(undefined), reload: vi.fn() });
  const render = async () => { await fixture.whenStable(); fixture.detectChanges(); };
  const tab = (section: string) => el.querySelector<HTMLButtonElement>(`#${section}-subtab-2`)!;
  beforeEach(async () => {
    getLogs.mockClear();
    await TestBed.configureTestingModule({ imports:[ProjectDocuments],providers:[
      { provide: DocumentoService,useValue:{} }, { provide: ProjectLogService,useValue:{ getByProyectoId:getLogs } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(ProjectDocuments);
    fixture.componentRef.setInput('projectId',2); el = fixture.nativeElement; await render();
  });

  it('starts in Documents and only loads logs when their subtab is opened', async () => {
    expect(tab('documents').getAttribute('aria-selected')).toBe('true');
    expect(getLogs).not.toHaveBeenCalled();
    tab('logs').click(); await render();
    expect(getLogs).toHaveBeenCalledOnce();
    expect(el.querySelector<HTMLElement>('#documents-panel-2')?.hidden).toBe(true);
    tab('documents').click(); await render();
    tab('logs').click(); await render();
    expect(getLogs).toHaveBeenCalledOnce();
  });

  it('supports arrow, Home and End keys with one tab stop', async () => {
    tab('documents').focus();
    tab('documents').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})); await render();
    expect(document.activeElement).toBe(tab('logs'));
    expect(tab('logs').tabIndex).toBe(0);
    expect(tab('documents').tabIndex).toBe(-1);
    tab('logs').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true})); await render();
    expect(document.activeElement).toBe(tab('documents'));
    tab('documents').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true})); await render();
    expect(document.activeElement).toBe(tab('logs'));
  });

  it('keeps logs accessible if the documents request fails', async () => {
    const reload = vi.fn(); fixture.componentInstance.reload.subscribe(reload);
    fixture.componentRef.setInput('hasError',true); await render();
    Array.from(el.querySelectorAll('button')).find(b=>b.textContent?.includes('Reintentar documentos'))!.click();
    expect(reload).toHaveBeenCalledOnce();
    tab('logs').click(); await render();
    expect(el.querySelector<HTMLElement>('#logs-panel-2')?.hidden).toBe(false);
    expect(el.querySelector('app-project-logs-tab')).not.toBeNull();
  });
});
