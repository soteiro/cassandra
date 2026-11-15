import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarioFormActividad, GuardarActividad } from './form-actividad';
import { Actividad, Calendario } from '../../data/calendario.model';

const CALENDARIOS: Calendario[] = [
  { id: 2, nombre: 'Hijo', color: '#58a6ff', tipo: 'actividades', oculto: false },
];

describe('CalendarioFormActividad', () => {
  let fixture: ComponentFixture<CalendarioFormActividad>;
  let el: HTMLElement;
  let guardados: GuardarActividad[];

  const boton = (texto: string) =>
    [...el.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === texto,
    ) as HTMLButtonElement;

  function crear(actividad: Actividad | null = null) {
    fixture = TestBed.createComponent(CalendarioFormActividad);
    fixture.componentRef.setInput('calendarios', CALENDARIOS);
    fixture.componentRef.setInput('actividad', actividad);
    fixture.componentRef.setInput('fechaInicial', '2026-11-17');
    fixture.componentRef.setInput('ocupado', () => []);
    fixture.detectChanges();
    el = fixture.nativeElement;
    guardados = [];
    fixture.componentInstance.guardar.subscribe((g) => guardados.push(g));
  }

  function semanal() {
    const check = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function enviar() {
    fixture.componentInstance.titulo.set('Terapia');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('una actividad semanal se repite sin fin por defecto', () => {
    crear();
    semanal();
    expect(boton('Nunca').getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain('sin fecha de término');
    enviar();
    expect(guardados[0].req).toMatchObject({ dias_semana: [1], hasta: null });
  });

  it('con fecha de término pide el último día', () => {
    crear();
    semanal();
    boton('En una fecha').click();
    fixture.detectChanges();
    enviar();
    expect(guardados).toEqual([]);
    expect(el.textContent).toContain('Elige el último día');

    fixture.componentInstance.hasta.set('2026-12-18');
    enviar();
    expect(guardados[0].req.hasta).toBe('2026-12-18');
  });

  it('al editar una actividad con término muestra su fecha, y se puede volver a sin fin', () => {
    crear({
      id: 5,
      calendario_id: 2,
      titulo: 'Colegio',
      fecha: '2026-03-02',
      hora_inicio: '08:00',
      hora_fin: '13:00',
      dias_semana: [0, 1, 2, 3, 4],
      hasta: '2026-12-18',
    });
    expect(boton('En una fecha').getAttribute('aria-pressed')).toBe('true');
    boton('Nunca').click();
    fixture.detectChanges();
    enviar();
    expect(guardados[0]).toMatchObject({ id: 5, req: { hasta: null } });
  });

  it('el select del calendario no usa alto fijo', () => {
    crear();
    const select = el.querySelector('select') as HTMLSelectElement;
    expect(select.className).toContain('min-h-11');
    expect(select.className).toContain('py-2');
    expect(select.className).not.toMatch(/(^|\s)h-11(\s|$)/);
  });
});
