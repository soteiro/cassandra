import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarioGestion, EditarCalendario } from './gestion-calendarios';
import { Calendario, CalendarioRequest, PALETA_CALENDARIO } from '../../data/calendario.model';

const CALENDARIOS: Calendario[] = [
  { id: 1, nombre: 'Turnos mamá', color: '#c297ff', tipo: 'turnos', oculto: false },
  { id: 2, nombre: 'Hijo', color: '#58a6ff', tipo: 'actividades', oculto: false },
];

describe('CalendarioGestion', () => {
  let fixture: ComponentFixture<CalendarioGestion>;
  let el: HTMLElement;

  const boton = (nombre: string) =>
    [...el.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === nombre || b.textContent?.trim() === nombre,
    ) as HTMLButtonElement;

  function escribir(input: HTMLInputElement, valor: string) {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarioGestion);
    fixture.componentRef.setInput('calendarios', CALENDARIOS);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('muestra los 12 colores y un selector libre', () => {
    const colores = el.querySelectorAll('app-calendario-selector-color button[aria-pressed]');
    expect(colores).toHaveLength(PALETA_CALENDARIO.length);
    expect(PALETA_CALENDARIO).toHaveLength(12);
    expect(el.querySelector('input[type="color"]')).not.toBeNull();
  });

  it('edita el nombre y el color de un calendario', () => {
    const emitidos: EditarCalendario[] = [];
    fixture.componentInstance.actualizar.subscribe((e) => emitidos.push(e));

    boton('Editar Hijo').click();
    fixture.detectChanges();
    const form = el.querySelector('form[aria-label="Editar Hijo"]') as HTMLFormElement;
    expect(form).not.toBeNull();
    // Mientras se edita no se muestra el formulario de nuevo calendario.
    expect(el.textContent).not.toContain('Nuevo calendario');

    escribir(form.querySelector('input[type="text"]') as HTMLInputElement, '  Hijo · terapias ');
    (form.querySelector('button[aria-label="Rosa"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    boton('Guardar').click();
    fixture.detectChanges();

    expect(emitidos).toEqual([{ id: 2, nombre: 'Hijo · terapias', color: '#f778ba' }]);
    expect(el.querySelector('form[aria-label="Editar Hijo"]')).toBeNull();
  });

  it('acepta un color libre del selector', () => {
    const emitidos: EditarCalendario[] = [];
    fixture.componentInstance.actualizar.subscribe((e) => emitidos.push(e));
    boton('Editar Turnos mamá').click();
    fixture.detectChanges();
    const form = el.querySelector('form[aria-label="Editar Turnos mamá"]') as HTMLFormElement;
    escribir(form.querySelector('input[type="color"]') as HTMLInputElement, '#123abc');
    boton('Guardar').click();
    expect(emitidos[0]).toEqual({ id: 1, nombre: 'Turnos mamá', color: '#123abc' });
  });

  it('cancelar no emite cambios', () => {
    const emitidos: EditarCalendario[] = [];
    fixture.componentInstance.actualizar.subscribe((e) => emitidos.push(e));
    boton('Editar Hijo').click();
    fixture.detectChanges();
    boton('Cancelar').click();
    fixture.detectChanges();
    expect(emitidos).toEqual([]);
    expect(el.textContent).toContain('Nuevo calendario');
  });

  it('crea un calendario con el color elegido', () => {
    const creados: CalendarioRequest[] = [];
    fixture.componentInstance.crear.subscribe((c) => creados.push(c));
    escribir(el.querySelector('input[placeholder="Ej.: Turnos mamá"]') as HTMLInputElement, 'Mamá');
    boton('Verde').click();
    fixture.detectChanges();
    boton('Crear calendario').click();
    expect(creados).toEqual([{ nombre: 'Mamá', tipo: 'actividades', color: '#7ee787' }]);
  });
});
