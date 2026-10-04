import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProjectCard } from './project-card';
import { ProjectResponse } from '../../models/proyect.model';

const makeProject = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: 42,
  nombre: 'Proyecto Card',
  descripcion: 'desc',
  comentario: '',
  fecha_creacion: '2026-03-01T10:00:00Z',
  estado: 'Pausado',
  por_que: '',
  para_que: '',
  criterio_finalizacion: '',
  prioridad: 'Critica',
  ...overrides,
});

describe('ProjectCard', () => {
  let component: ProjectCard;
  let fixture: ComponentFixture<ProjectCard>;
  let el: HTMLElement;

  const render = async (overrides: Partial<ProjectResponse> = {}, isSubproject = false) => {
    fixture.componentRef.setInput('project', makeProject(overrides));
    fixture.componentRef.setInput('isSubproject', isSubproject);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectCard);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('should link to the project detail and render basic info', async () => {
    await render();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/proyectos/42');
    expect(el.querySelector('h3')?.textContent).toContain('Proyecto Card');
    expect(el.textContent).toContain('Critica');
    expect(el.textContent).toContain('Pausado');
    expect(el.textContent).toContain('Abrir');
  });

  it('should apply priority and status classes to the badges', async () => {
    await render();
    const html = el.innerHTML;
    expect(html).toContain('text-danger');
    expect(html).toContain('text-amber-300');
  });

  it('should prefer para_que over descripcion', async () => {
    await render({ para_que: 'Objetivo claro', descripcion: 'otra cosa' });
    expect(el.textContent).toContain('Objetivo claro');
    expect(el.textContent).not.toContain('otra cosa');
  });

  it('should show subproject count badge only for root projects', async () => {
    await render({ subproyectos_count: 2 });
    expect(el.textContent).toContain('2 subproyectos');

    await render({ subproyectos_count: 2 }, true);
    expect(el.textContent).not.toContain('2 subproyectos');
  });

  it('should show parent name and "Ver Tareas" when rendered as subproject', async () => {
    await render({ nombre_padre: 'Paraguas' }, true);
    expect(el.textContent).toContain('Subproyecto de:');
    expect(el.textContent).toContain('Paraguas');
    expect(el.textContent).toContain('Ver Tareas');
  });

  it('should hide parent name when not a subproject', async () => {
    await render({ nombre_padre: 'Paraguas' }, false);
    expect(el.textContent).not.toContain('Subproyecto de:');
  });

  it('should render meta and deadline when present', async () => {
    await render({ criterio_finalizacion: 'Todo verde', fecha_limite: '2026-12-31T12:00:00Z' });
    expect(el.textContent).toContain('Meta:');
    expect(el.textContent).toContain('Todo verde');
    expect(el.textContent).toContain('Límite: 31/12/2026');
  });

  it('should map priority and status helpers', () => {
    expect(component.getPriorityClass('Media')).toContain('text-blue-300');
    expect(component.getPriorityClass('otra')).toContain('text-text-muted');
    expect(component.getStatusClass('Activo')).toContain('text-accent');
    expect(component.getStatusClass('Idea')).toContain('text-purple-300');
  });
});
