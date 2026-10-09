import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProjectHeader } from './project-header';
import { ProjectResponse } from '../../../../models/proyect.model';

const makeProject = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: 1,
  nombre: 'Cassandra',
  descripcion: '',
  comentario: '',
  fecha_creacion: '2026-01-15T10:00:00Z',
  estado: 'En Proceso',
  por_que: '',
  para_que: '',
  criterio_finalizacion: '',
  prioridad: 'Alta',
  ...overrides,
});

describe('ProjectHeader', () => {
  let component: ProjectHeader;
  let fixture: ComponentFixture<ProjectHeader>;
  let el: HTMLElement;

  const render = async (overrides: Partial<ProjectResponse> = {}) => {
    fixture.componentRef.setInput('project', makeProject(overrides));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectHeader],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectHeader);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('should render name, priority and status', async () => {
    await render();
    expect(el.querySelector('h1')?.textContent).toContain('Cassandra');
    expect(el.textContent).toContain('Prioridad: Alta');
    expect(el.textContent).toContain('Estado: En Proceso');
  });

  it('should not render parent breadcrumb nor subproject badge for a root project', async () => {
    await render();
    expect(el.querySelector('a[title="Ir al proyecto padre"]')).toBeNull();
    expect(el.textContent).not.toContain('subproyecto');
  });

  it('should render parent breadcrumb linking to the parent project', async () => {
    await render({ proyecto_padre_id: 7, nombre_padre: 'Padre X' });
    const link = el.querySelector('a[title="Ir al proyecto padre"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/proyectos/7');
    expect(link.textContent).toContain('Padre X');
    expect(el.textContent).toContain('Subproyecto de:');
  });

  it('should fall back to "Proyecto Padre" when parent name is missing', async () => {
    await render({ proyecto_padre_id: 7 });
    expect(el.querySelector('a[title="Ir al proyecto padre"]')?.textContent).toContain(
      'Proyecto Padre',
    );
  });

  it('should pluralize subproject count badge', async () => {
    await render({ subproyectos_count: 1 });
    expect(el.textContent).toMatch(/1 subproyecto(?!s)/);
    await render({ subproyectos_count: 3 });
    expect(el.textContent).toContain('3 subproyectos');
  });

  it('should render criterio de finalización only when present', async () => {
    await render();
    expect(el.textContent).not.toContain('Criterio de Finalización');
    await render({ criterio_finalizacion: 'Deploy en prod' });
    expect(el.textContent).toContain('Criterio de Finalización');
    expect(el.textContent).toContain('Deploy en prod');
  });

  it('should emit edit and delete when buttons are clicked', async () => {
    await render();
    const editSpy = vi.fn();
    const deleteSpy = vi.fn();
    component.edit.subscribe(editSpy);
    component.delete.subscribe(deleteSpy);

    (el.querySelector('button[title="Editar proyecto"]') as HTMLButtonElement).click();
    (el.querySelector('button[title="Eliminar proyecto"]') as HTMLButtonElement).click();

    expect(editSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('should map priorities to classes', () => {
    expect(component.getPriorityClass('Critica')).toContain('text-danger');
    expect(component.getPriorityClass('Alta')).toContain('text-amber-300');
    expect(component.getPriorityClass('Media')).toContain('text-blue-300');
    expect(component.getPriorityClass('Baja')).toContain('text-text-muted');
    expect(component.getPriorityClass(undefined)).toContain('text-text-muted');
  });

  it('should map statuses to classes', () => {
    expect(component.getStatusClass('Completado')).toContain('text-success');
    expect(component.getStatusClass('Terminado')).toContain('text-success');
    expect(component.getStatusClass('En Curso')).toContain('text-accent');
    expect(component.getStatusClass('Bloqueado')).toContain('text-amber-300');
    expect(component.getStatusClass('Cancelado')).toContain('text-danger');
    expect(component.getStatusClass('Idea')).toContain('text-purple-300');
    expect(component.getStatusClass('No Listado')).toContain('text-text-muted');
    expect(component.getStatusClass('desconocido')).toContain('text-text-muted');
  });

  describe('propósito plegable', () => {
    beforeEach(() => localStorage.removeItem('cassandra.proyecto.mostrarProposito'));

    const boton = () =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('propósito')) as HTMLButtonElement;

    it('viene plegado y se abre y cierra con un click', async () => {
      await render({ por_que: 'Porque sí', para_que: 'Para algo' });
      expect(el.textContent).not.toContain('Porque sí');
      expect(boton().getAttribute('aria-expanded')).toBe('false');

      boton().click();
      fixture.detectChanges();
      expect(el.textContent).toContain('Porque sí');
      expect(el.textContent).toContain('Para algo');
      expect(localStorage.getItem('cassandra.proyecto.mostrarProposito')).toBe('true');

      boton().click();
      fixture.detectChanges();
      expect(el.textContent).not.toContain('Porque sí');
    });

    it('sin propósito ni descripción no muestra el botón', async () => {
      await render();
      expect(boton()).toBeUndefined();
    });
  });

  it('muestra la última actividad cuando existe', async () => {
    await render({ ultima_actividad: new Date().toISOString() });
    expect(el.textContent).toContain('Última actividad hoy');
  });
});
