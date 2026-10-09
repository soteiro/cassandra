import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { SemanaWidget } from './semana-widget';
import { ActividadService } from '../../services/actividad.service';
import { ResumenActividad } from '../../models/actividad.model';
import { inicioDeSemana } from '../../utils/actividad.util';

function resumen(over: Partial<ResumenActividad> = {}): ResumenActividad {
  return {
    desde: '',
    hasta: '',
    tareas_terminadas: [],
    proyectos_completados: [],
    flujo: { creadas: 0, terminadas: 0 },
    otros: { interacciones: 0, personas_contactadas: 0, reflexiones: 0, notas: 0 },
    ...over,
  };
}

describe('SemanaWidget', () => {
  let fixture: ComponentFixture<SemanaWidget>;
  let component: SemanaWidget;
  let el: HTMLElement;
  let periodo: () => { desde: Date; hasta: Date } | null;
  let resource: {
    value: ReturnType<typeof signal<ResumenActividad | undefined>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<unknown>>;
    reload: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    resource = {
      value: signal<ResumenActividad | undefined>(resumen()),
      isLoading: signal(false),
      error: signal<unknown>(undefined),
      reload: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [SemanaWidget],
      providers: [
        provideRouter([]),
        {
          provide: ActividadService,
          useValue: {
            getResumen: (p: typeof periodo) => {
              periodo = p;
              return resource;
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SemanaWidget);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('pide la semana actual, de lunes a lunes', () => {
    const lunes = inicioDeSemana(new Date());
    expect(periodo()!.desde).toEqual(lunes);
    expect(periodo()!.hasta.getDay()).toBe(1);
    expect(el.textContent).toContain('Esta semana');
  });

  it('navega a la semana anterior y no pasa de la actual', () => {
    const lunes = inicioDeSemana(new Date());
    component.siguiente();
    expect(periodo()!.desde).toEqual(lunes);

    component.anterior();
    fixture.detectChanges();
    expect(periodo()!.hasta).toEqual(lunes);
    expect(el.textContent).toContain('Semana del');

    component.siguiente();
    expect(periodo()!.desde).toEqual(lunes);
  });

  it('agrupa lo terminado por proyecto y muestra el flujo', () => {
    resource.value.set(
      resumen({
        tareas_terminadas: [
          { id: 1, nombre: 'Flete', prioridad: 'alta', proyecto_id: 7, proyecto_nombre: 'Mudanza', fecha_terminado: '' },
          { id: 2, nombre: 'Cajas', prioridad: 'normal', proyecto_id: 7, proyecto_nombre: 'Mudanza', fecha_terminado: '', tarea_padre_id: 1 },
          { id: 3, nombre: 'CI', prioridad: 'normal', proyecto_id: 9, proyecto_nombre: 'Cassandra', fecha_terminado: '' },
        ],
        flujo: { creadas: 12, terminadas: 3 },
        otros: { interacciones: 2, personas_contactadas: 1, reflexiones: 1, notas: 0 },
      }),
    );
    fixture.detectChanges();

    expect(component.porProyecto().map((g) => [g.proyectoNombre, g.tareas.length])).toEqual([
      ['Mudanza', 2],
      ['Cassandra', 1],
    ]);
    expect(el.textContent).toContain('Terminaste 3 tareas');
    expect(el.textContent).toContain('(subtarea)');
    expect(el.textContent).toContain('Entraron 12 · salieron 3');
    expect(el.textContent).toContain('2 interacciones con 1 persona · 1 reflexión');
    expect(el.textContent).not.toContain('nota');
  });

  it('sin nada terminado lo dice sin juicio', () => {
    expect(el.textContent).toContain('Todavía no hay nada terminado esta semana.');
  });

  it('muestra el error con opción de reintentar', () => {
    resource.error.set(new Error('x'));
    fixture.detectChanges();
    (el.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    expect(resource.reload).toHaveBeenCalled();
  });
});
