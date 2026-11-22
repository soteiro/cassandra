import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ProjectLogsTab } from './project-logs-tab';
import { ProjectLogService } from '../../data/project-log.service';
import { ProjectLog } from '../../data/project-log.model';

const log: ProjectLog = {
  id: 5,
  proyecto_id: 2,
  user_id: 1,
  titulo: 'Avance de memoria',
  contenido_raw:
    '## Resultado\n\n**Funciona** con `MCP`.\n\n- Leer\n- Guardar\n\n<script>alert(1)</script>',
  fecha_creacion: '2026-10-18T12:00:00Z',
  fecha_actualizacion: '2026-10-18T12:00:00Z',
  gestionado: true,
  eliminado: false,
};

describe('ProjectLogsTab', () => {
  let fixture: ComponentFixture<ProjectLogsTab>;
  let el: HTMLElement;
  const resource = {
    value: signal<ProjectLog[]>([]),
    isLoading: signal(false),
    error: signal<unknown>(undefined),
    reload: vi.fn(),
  };
  const get = vi.fn().mockReturnValue(resource);
  const render = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  /** Despliega (o pliega) la entrada como lo haría el navegador al pulsar su <summary>. */
  const toggle = async (id: number, open = true) => {
    const details = el.querySelector<HTMLDetailsElement>(`details[data-log-id="${id}"]`)!;
    details.open = open;
    details.dispatchEvent(new Event('toggle'));
    await render();
  };
  const button = (text: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  beforeEach(async () => {
    resource.value.set([log]);
    resource.isLoading.set(false);
    resource.error.set(undefined);
    resource.reload.mockClear();
    get.mockClear();
    await TestBed.configureTestingModule({
      imports: [ProjectLogsTab],
      providers: [{ provide: ProjectLogService, useValue: { getByProyectoId: get } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectLogsTab);
    fixture.componentRef.setInput('projectId', 2);
    el = fixture.nativeElement;
    await render();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('expands a log inline with the safe Markdown renderer, keeping the list', async () => {
    expect(el.querySelector('.prose-container')).toBeNull();
    expect(el.querySelector('details summary')?.textContent).toContain('Avance de memoria');
    await toggle(5);
    expect(el.querySelector('.prose-container h2')?.textContent).toBe('Resultado');
    expect(el.querySelector('strong')?.textContent).toBe('Funciona');
    expect(el.querySelector('code')?.textContent).toBe('MCP');
    expect(el.querySelectorAll('.prose-container li').length).toBe(2);
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('Esta entrada se actualiza con la memoria del proyecto.');
    expect(el.querySelector('input[type="search"]')).not.toBeNull();
    await toggle(5, false);
    expect(el.querySelector('.prose-container')).toBeNull();
  });

  it('copies raw Markdown and reports clipboard failures accurately', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await toggle(5);
    button('Copiar').click();
    await render();
    expect(writeText).toHaveBeenCalledWith(log.contenido_raw);
    expect(el.textContent).toContain('Markdown copiado.');
    writeText.mockRejectedValue(new Error('denied'));
    button('Copiar').click();
    await render();
    expect(el.textContent).toContain('No se pudo copiar');
    expect(el.textContent).not.toContain('Markdown copiado.');
  });

  it('shows loading, recoverable errors and empty states independently', async () => {
    resource.isLoading.set(true);
    await render();
    expect(el.textContent).toContain('Cargando Project logs');
    expect(el.querySelector('[data-log-id]')).toBeNull();
    resource.isLoading.set(false);
    resource.error.set(new Error('offline'));
    await render();
    button('Reintentar Project logs').click();
    expect(resource.reload).toHaveBeenCalledOnce();
    resource.error.set(undefined);
    resource.value.set([]);
    await render();
    expect(el.textContent).toContain('Todavía no hay logs en este proyecto');
  });

  it('searches the full backend collection and distinguishes no matches from no logs', async () => {
    const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'sin resultados';
    input.dispatchEvent(new Event('input'));
    resource.value.set([]);
    await render();
    expect(get.mock.calls[0][1]()).toBe('sin resultados');
    expect(get.mock.calls[0][2]()).toBe(0);
    expect(el.textContent).toContain('No hay logs que coincidan');
  });

  it('shows thirty entries per page and advances the backend offset', async () => {
    resource.value.set(
      Array.from({ length: 31 }, (_, index) => ({
        ...log,
        id: index + 1,
        titulo: `Sesión ${index + 1}`,
      })),
    );
    await render();
    expect(el.querySelectorAll('[data-log-id]').length).toBe(30);
    expect(button('Anterior').disabled).toBe(true);
    button('Siguiente').click();
    await render();
    expect(get.mock.calls[0][2]()).toBe(30);
    expect(button('Anterior').disabled).toBe(false);
    resource.value.set([log]);
    await render();
    expect(button('Siguiente').disabled).toBe(true);
  });

  it('collapses expanded entries when the route changes', async () => {
    await toggle(5);
    fixture.componentRef.setInput('projectId', 3);
    await render();
    expect(el.querySelector('.prose-container')).toBeNull();
    resource.value.set([]);
    await render();
    expect(get.mock.calls[0][0]()).toBe(3);
    expect(el.textContent).not.toContain('Avance de memoria');
  });
});
