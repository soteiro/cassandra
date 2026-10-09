import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { ProyectDetails } from './proyect-details';
import { proyectService } from '../../services/proyect.service';
import { ProjectResponse } from '../../models/proyect.model';
import { DocumentoService } from '../../services/documento.service';
import { DocumentoProyecto } from '../../models/documento.model';

describe('ProyectDetails', () => {
  let component: ProyectDetails;
  let fixture: ComponentFixture<ProyectDetails>;
  let service: proyectService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProyectDetails],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProyectDetails);
    component = fixture.componentInstance;
    service = TestBed.inject(proyectService);
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

  // La lista global de proyectos (proyectResource) es compartida: debe refrescarse
  // tras cualquier cambio hecho desde el detalle para que /proyectos no quede desactualizado.
  describe('refresco de la lista global de proyectos', () => {
    it('tras eliminar el proyecto', () => {
      vi.spyOn(service, 'deleteProyect').mockReturnValue(of(undefined));
      component.openDeleteProjectModal({ id: 5, nombre: 'P' } as ProjectResponse);
      component.confirmDeleteProject();
      expect(service.reload).toHaveBeenCalled();
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/proyectos']);
    });

    it('tras editar el proyecto', () => {
      vi.spyOn(service, 'updateProyect').mockReturnValue(of({} as ProjectResponse));
      component.saveEditProject({ nombre: 'Nuevo' });
      expect(service.reload).toHaveBeenCalled();
    });

    it('tras crear un subproyecto', () => {
      vi.spyOn(service, 'createProyect').mockReturnValue(of({} as ProjectResponse));
      component.saveCreateSubproject({ nombre: 'Hijo' });
      expect(service.reload).toHaveBeenCalled();
    });
  });

  describe('retrospectiva', () => {
    const proyecto = { id: 5, nombre: 'Mudanza', para_que: 'Vivir cerca', estado: 'En Proceso' } as ProjectResponse;

    beforeEach(() => {
      // Sin sesión en el test el recurso no existe: se reemplaza por un doble.
      Object.assign(component, { projectResource: { value: () => proyecto, reload: vi.fn() } });
      vi.spyOn(service, 'updateProyect').mockReturnValue(of({} as ProjectResponse));
    });

    it('se guarda como documento y no se envía a la API de proyectos', () => {
      const docs = TestBed.inject(DocumentoService);
      const crear = vi.spyOn(docs, 'createDocumento').mockReturnValue(of({} as DocumentoProyecto));
      component.saveEditProject({ estado: 'Completado', retrospectiva: { cumplido: 'Sí', aprendido: '' } });

      expect(service.updateProyect).toHaveBeenCalledWith(component['projectIdNumber'](), { estado: 'Completado' });
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
