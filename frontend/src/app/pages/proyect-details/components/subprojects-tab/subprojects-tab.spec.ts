import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SubprojectsTab } from './subprojects-tab';
import { ProjectResponse } from '../../../../models/proyect.model';

const makeProject = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: 1,
  nombre: 'Sub',
  descripcion: '',
  comentario: '',
  fecha_creacion: '2026-01-01T00:00:00Z',
  estado: 'No Listado',
  por_que: '',
  para_que: '',
  criterio_finalizacion: '',
  prioridad: 'Media',
  ...overrides,
});

describe('SubprojectsTab', () => {
  let component: SubprojectsTab;
  let fixture: ComponentFixture<SubprojectsTab>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubprojectsTab],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SubprojectsTab);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  const render = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('should show loading state when loading and empty', async () => {
    fixture.componentRef.setInput('isLoading', true);
    await render();
    expect(el.textContent).toContain('Cargando subproyectos...');
    expect(el.querySelector('button')).toBeNull();
  });

  it('should show empty state and emit create from both buttons', async () => {
    await render();
    expect(el.textContent).toContain('No hay subproyectos en este proyecto');
    const spy = vi.fn();
    component.create.subscribe(spy);
    const buttons = el.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    buttons.forEach((b) => b.click());
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should render one project card per subproject (even while loading)', async () => {
    fixture.componentRef.setInput('isLoading', true);
    fixture.componentRef.setInput('subproyectos', [
      makeProject({ id: 1, nombre: 'A' }),
      makeProject({ id: 2, nombre: 'B' }),
    ]);
    await render();
    expect(el.querySelectorAll('app-project-card').length).toBe(2);
    expect(el.textContent).toContain('Subproyectos vinculados (2)');
  });

  it('should sort by priority weight then by newest creation date', () => {
    fixture.componentRef.setInput('subproyectos', [
      makeProject({ id: 1, prioridad: 'Baja', fecha_creacion: '2026-01-01' }),
      makeProject({ id: 2, prioridad: 'Media', fecha_creacion: '2026-01-01' }),
      makeProject({ id: 3, prioridad: 'Media', fecha_creacion: '2026-05-01' }),
      makeProject({ id: 4, prioridad: 'Crítica', fecha_creacion: '2026-01-01' }),
      makeProject({ id: 5, prioridad: 'alta', fecha_creacion: '2026-01-01' }),
      makeProject({ id: 6, prioridad: 'desconocida', fecha_creacion: '2026-09-01' }),
    ]);
    expect(component.getSortedSubprojects().map((p) => p.id)).toEqual([4, 5, 3, 2, 1, 6]);
  });

  it('should not mutate the input array when sorting', () => {
    const list = [
      makeProject({ id: 1, prioridad: 'Baja' }),
      makeProject({ id: 2, prioridad: 'Critica' }),
    ];
    fixture.componentRef.setInput('subproyectos', list);
    component.getSortedSubprojects();
    expect(list.map((p) => p.id)).toEqual([1, 2]);
  });
});
