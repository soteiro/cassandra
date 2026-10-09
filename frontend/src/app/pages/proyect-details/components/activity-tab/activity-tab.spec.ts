import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivityTab } from './activity-tab';
import { EventoActividad } from '../../../../models/actividad.model';

function evento(over: Partial<EventoActividad>): EventoActividad {
  return {
    id: 1,
    entidad: 'tarea',
    entidad_id: 1,
    accion: 'creado',
    cambios: {},
    origen: 'app',
    ocurrido_en: '2026-10-08T15:00:00',
    nombre: 'Deploy',
    eliminado: false,
    ...over,
  };
}

describe('ActivityTab', () => {
  let fixture: ComponentFixture<ActivityTab>;
  let el: HTMLElement;

  const render = (eventos: EventoActividad[], extra: { hayMas?: boolean } = {}) => {
    fixture.componentRef.setInput('eventos', eventos);
    fixture.componentRef.setInput('hayMas', extra.hayMas ?? false);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ActivityTab] }).compileComponents();
    fixture = TestBed.createComponent(ActivityTab);
    el = fixture.nativeElement;
  });

  it('agrupa por día y describe cada evento', () => {
    render([
      evento({ id: 3, accion: 'modificado', cambios: { estado: { antes: 'Abierto', despues: 'En Curso' } }, ocurrido_en: '2026-10-08T16:00:00' }),
      evento({ id: 2, entidad: 'nota', nombre: 'Respaldar antes del deploy', ocurrido_en: '2026-10-08T10:00:00' }),
      evento({ id: 1, ocurrido_en: '2026-10-01T09:00:00' }),
    ]);
    expect(el.querySelectorAll('section').length).toBe(2);
    expect(el.textContent).toContain('Tarea «Deploy»: estado Abierto → En Curso');
    expect(el.textContent).toContain('Nota agregada');
    expect(el.textContent).toContain('«Respaldar antes del deploy»');
    expect(el.textContent).toContain('Tarea «Deploy» creada');
  });

  it('marca lo reconstruido como aproximado', () => {
    render([evento({ origen: 'backfill' })]);
    expect(el.textContent).toContain('aprox.');
  });

  it('sin eventos lo dice', () => {
    render([]);
    expect(el.textContent).toContain('Todavía no hay actividad registrada');
  });

  it('ver más emite solo si hay más', () => {
    render([evento({})]);
    expect(el.querySelector('button')).toBeNull();

    render([evento({})], { hayMas: true });
    const spy = vi.fn();
    fixture.componentInstance.verMas.subscribe(spy);
    (el.querySelector('button') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalled();
  });
});
