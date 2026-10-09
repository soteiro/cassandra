import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { Revision } from './revision';
import { RevisionService } from '../../services/revision.service';
import { TaskService } from '../../services/task.service';
import { proyectService } from '../../services/proyect.service';
import { ActividadService } from '../../services/actividad.service';
import { TareaEstancada } from '../../models/revision.model';
import { ProjectResponse } from '../../models/proyect.model';

function estancada(id: number): TareaEstancada {
  return {
    id,
    nombre: `Tarea ${id}`,
    estado: 'Abierto',
    prioridad: 'normal',
    proyecto_id: 1,
    proyecto_nombre: 'Casa',
    fecha_actualizacion: '2026-09-01T00:00:00Z',
    dias_sin_cambios: 30,
  };
}

describe('Revision', () => {
  let fixture: ComponentFixture<Revision>;
  let component: Revision;
  let tasks: { updateTask: ReturnType<typeof vi.fn>; deleteTask: ReturnType<typeof vi.fn> };
  let proyectos: { proyectResource: { value: ReturnType<typeof signal> }; updateProyect: ReturnType<typeof vi.fn>; reload: ReturnType<typeof vi.fn> };
  let revision: { crearRevision: ReturnType<typeof vi.fn> } & Record<string, unknown>;

  beforeEach(async () => {
    tasks = { updateTask: vi.fn().mockReturnValue(of({})), deleteTask: vi.fn().mockReturnValue(of(undefined)) };
    proyectos = {
      proyectResource: {
        value: signal<ProjectResponse[]>([
          { id: 1, nombre: 'Activo', estado: 'En Proceso', para_que: 'Algo' } as ProjectResponse,
          { id: 2, nombre: 'Pausado', estado: 'Pausado' } as ProjectResponse,
        ]),
      },
      updateProyect: vi.fn().mockReturnValue(of({})),
      reload: vi.fn(),
    };
    revision = {
      preferenciasResource: { value: signal({ dia_revision: 0, limite_en_curso: 5 }), reload: vi.fn() },
      revisionesResource: { value: signal([]), reload: vi.fn() },
      getEstancadas: () => ({ value: signal([estancada(1), estancada(2), estancada(3)]), isLoading: signal(false), error: signal(undefined) }),
      crearRevision: vi.fn().mockReturnValue(of({})),
      actualizarPreferencias: vi.fn().mockReturnValue(of({})),
    };
    await TestBed.configureTestingModule({
      imports: [Revision],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RevisionService, useValue: revision },
        { provide: TaskService, useValue: tasks },
        { provide: proyectService, useValue: proyectos },
        {
          provide: ActividadService,
          useValue: {
            getResumen: () => ({
              value: signal({ flujo: { creadas: 5, terminadas: 3 }, tareas_terminadas: [], proyectos_completados: [], otros: { interacciones: 0, personas_contactadas: 0, reflexiones: 0, notas: 0 } }),
              isLoading: signal(false),
              error: signal(undefined),
              reload: vi.fn(),
            }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Revision);
    component = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('cada decisión cambia la tarea como corresponde y la saca de la lista', () => {
    const [t1, t2, t3] = component.pendientes();
    component.decidirTarea(t1, 'pausa');
    component.decidirTarea(t2, 'descartada');
    component.decidirTarea(t3, 'sigue');
    expect(tasks.updateTask).toHaveBeenCalledWith(1, { estado: 'Pendiente' });
    expect(tasks.deleteTask).toHaveBeenCalledWith(2);
    expect(tasks.updateTask).toHaveBeenCalledTimes(1);
    expect(component.pendientes()).toEqual([]);
  });

  it('pasar todas a pausa', () => {
    component.pausarTodas();
    expect(tasks.updateTask).toHaveBeenCalledTimes(3);
    expect(component.pendientes()).toEqual([]);
  });

  it('solo revisa proyectos en marcha y puede pausarlos', () => {
    expect(component.proyectosActivos().map((p) => p.id)).toEqual([1]);
    component.decidirProyecto(component.proyectosActivos()[0], 'pausado');
    expect(proyectos.updateProyect).toHaveBeenCalledWith(1, { estado: 'Pausado' });
  });

  it('guarda la nota con el resumen de la revisión', () => {
    const [t1, t2] = component.pendientes();
    component.decidirTarea(t1, 'hecha');
    component.decidirTarea(t2, 'sigue');
    component.nota.set('  Buena semana ');
    component.guardar();
    expect(revision.crearRevision).toHaveBeenCalledWith('Buena semana', {
      terminadas: 3,
      creadas: 5,
      estancadas: 3,
      decisiones: { hecha: 1, sigue: 1 },
      proyectos_revisados: 0,
      proyectos_pausados: 0,
    });
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/home']);
  });

  it('navega entre pasos sin salirse de los límites', () => {
    component.anterior();
    expect(component.paso()).toBe(0);
    for (let i = 0; i < 10; i++) component.siguiente();
    expect(component.paso()).toBe(3);
  });
});
