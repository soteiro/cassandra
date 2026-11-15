import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Capa, CalendarioCapas } from './capas';

const CAPAS: Capa[] = [
  { clave: 'deadlines', nombre: 'Deadlines', color: 'var(--theme-warning)', visible: true },
  { clave: '1', nombre: 'Turnos mamá', color: '#c297ff', visible: true, turnosId: 1 },
  { clave: '2', nombre: 'Hijo', color: '#58a6ff', visible: false },
];

describe('CalendarioCapas', () => {
  let fixture: ComponentFixture<CalendarioCapas>;
  let el: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarioCapas);
    fixture.componentRef.setInput('capas', CAPAS);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  const textos = () => [...el.querySelectorAll('button')].map((b) => b.textContent?.trim());

  it('pone los filtros primero y las acciones al final', () => {
    expect(textos()).toEqual(['Deadlines', 'Turnos mamá', 'Hijo', 'Ciclo', 'Calendarios…']);
    const grupo = el.querySelector('[role="group"]')!;
    expect(grupo.querySelectorAll('button')).toHaveLength(3);
  });

  it('marca qué capas están visibles', () => {
    const filtros = [...el.querySelectorAll('[role="group"] button')];
    expect(filtros.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'false']);
  });

  it('el botón de ciclo emite su calendario y nombra cuál es si hay varios', () => {
    const emitidos: number[] = [];
    fixture.componentInstance.ciclo.subscribe((id) => emitidos.push(id));
    const ciclo = [...el.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Ajustar el ciclo de Turnos mamá',
    )!;
    ciclo.click();
    expect(emitidos).toEqual([1]);

    fixture.componentRef.setInput('capas', [
      ...CAPAS,
      { clave: '3', nombre: 'Turnos papá', color: '#8b93ff', visible: true, turnosId: 3 },
    ]);
    fixture.detectChanges();
    expect(textos()).toContain('Ciclo · Turnos mamá');
    expect(textos()).toContain('Ciclo · Turnos papá');
  });
});
