import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { ProyectDetails } from './proyect-details';
import { proyectService } from '../../services/proyect.service';
import { ProjectResponse } from '../../models/proyect.model';

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
});
