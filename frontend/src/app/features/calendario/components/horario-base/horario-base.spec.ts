import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarioHorarioBase } from './horario-base';
import { FranjaHorario } from '../../data/calendario.model';

describe('CalendarioHorarioBase', () => {
  let fixture: ComponentFixture<CalendarioHorarioBase>;
  let el: HTMLElement;
  let guardados: FranjaHorario[][];

  const boton = (texto: string) =>
    [...el.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === texto || b.textContent?.trim() === texto,
    ) as HTMLButtonElement;

  function crear(franjas: FranjaHorario[]) {
    fixture = TestBed.createComponent(CalendarioHorarioBase);
    fixture.componentRef.setInput('franjas', franjas);
    fixture.detectChanges();
    el = fixture.nativeElement;
    guardados = [];
    fixture.componentInstance.guardar.subscribe((f) => guardados.push(f));
  }

  const enviar = () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  it('muestra las franjas por día y guarda la medianoche como 24:00', () => {
    crear([
      { dia_semana: 0, hora_inicio: '14:00', hora_fin: '18:00' },
      { dia_semana: 5, hora_inicio: '21:00', hora_fin: '24:00' },
    ]);
    expect(el.querySelectorAll('input[type="time"]')).toHaveLength(4);
    expect(el.textContent).toContain('No trabajo');
    enviar();
    expect(guardados[0]).toEqual([
      { dia_semana: 0, hora_inicio: '14:00', hora_fin: '18:00' },
      { dia_semana: 5, hora_inicio: '21:00', hora_fin: '24:00' },
    ]);
  });

  it('copia el lunes a los días hábiles', () => {
    crear([{ dia_semana: 0, hora_inicio: '09:00', hora_fin: '13:00' }]);
    boton('Usar el horario del lunes de martes a viernes').click();
    fixture.detectChanges();
    enviar();
    expect(guardados[0].map((f) => f.dia_semana)).toEqual([0, 1, 2, 3, 4]);
  });

  it('no guarda franjas que se solapan ni que terminan antes de empezar', () => {
    crear([]);
    boton('Agregar franja el martes').click();
    boton('Agregar franja el martes').click();
    fixture.detectChanges();
    const [, , ini2] = [...el.querySelectorAll<HTMLInputElement>('input[type="time"]')];
    ini2.value = '12:00';
    ini2.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('se solapan');
    enviar();
    expect(guardados).toEqual([]);

    fixture.componentInstance.dias.update((d) =>
      d.map((f, i) => (i === 1 ? [{ inicio: '18:00', fin: '10:00' }] : f)),
    );
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('terminar después');
  });
});
