import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { ProjectDetails } from './project-details';
import { ProjectService } from '../../data/project.service';
import { ProjectResponse } from '../../data/project.model';
import { DocumentoService } from '../../data/documento.service';
import { DocumentoProyecto } from '../../data/documento.model';

describe('ProjectDetails', () => {
  let component: ProjectDetails;
  let fixture: ComponentFixture<ProjectDetails>;
  let service: ProjectService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectDetails],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetails);
    component = fixture.componentInstance;
    service = TestBed.inject(ProjectService);
    vi.spyOn(service, 'reload').mockImplementation(() => {});
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to the tareas tab and switch tabs', () => {
    expect(component.activeTab()).toBe('tareas');
    component.selectedTab('notas');
    expect(component.activeTab()).toBe('notas');
  });

  // La lista global de proyectos (projectsResource) es compartida: debe refrescarse
  // tras cualquier cambio hecho desde el detalle para que /proyectos no quede desactualizado.
  describe('refresco de la lista global de proyectos', () => {
    it('tras eliminar el proyecto', () => {
      vi.spyOn(service, 'deleteProject').mockReturnValue(of(undefined));
      component.openDeleteProjectModal({ id: 5, nombre: 'P' } as ProjectResponse);
      component.confirmDeleteProject();
      expect(service.reload).toHaveBeenCalled();
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/proyectos']);
    });

    it('tras editar el proyecto', () => {
      vi.spyOn(service, 'updateProject').mockReturnValue(of({} as ProjectResponse));
      component.saveEditProject({ nombre: 'Nuevo' });
      expect(service.reload).toHaveBeenCalled();
    });

    it('tras crear un subproyecto', () => {
      vi.spyOn(service, 'createProject').mockReturnValue(of({} as ProjectResponse));
      component.saveCreateSubproject({ nombre: 'Hijo' });
      expect(service.reload).toHaveBeenCalled();
    });
  });

  describe('retrospectiva', () => {
    const proyecto = { id: 5, nombre: 'Mudanza', para_que: 'Vivir cerca', estado: 'En Proceso' } as ProjectResponse;

    beforeEach(() => {
      // Sin sesión en el test el recurso no existe: se reemplaza por un doble.
      Object.assign(component, { projectResource: { value: () => proyecto, reload: vi.fn() } });
      vi.spyOn(service, 'updateProject').mockReturnValue(of({} as ProjectResponse));
    });

    it('se guarda como documento y no se envía a la API de proyectos', () => {
      const docs = TestBed.inject(DocumentoService);
      const crear = vi.spyOn(docs, 'createDocumento').mockReturnValue(of({} as DocumentoProyecto));
      component.saveEditProject({ estado: 'Completado', retrospectiva: { cumplido: 'Sí', aprendido: '' } });

      expect(service.updateProject).toHaveBeenCalledWith(component['projectIdNumber'](), { estado: 'Completado' });
      expect(crear).toHaveBeenCalledTimes(1);
      const [id, req] = crear.mock.calls[0];
      expect(id).toBe(5);
      expect(req.tipo).toBe('retrospectiva');
      expect(req.titulo).toBe('Retrospectiva: Mudanza');
      expect(req.contenido).toContain('## ¿Se cumplió el para qué?\n\nSí');
    });

    it('sin respuestas no crea documento', () => {
      const crear = vi.spyOn(TestBed.inject(DocumentoService), 'createDocumento');
      component.saveEditProject({ estado: 'Completado' });
      expect(crear).not.toHaveBeenCalled();
    });
  });
});
