import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovimientoRow } from './movimiento-row';
import { EstadoFinanzas, FinanzasPlantillaItem } from '../../data/finanzas.model';

function item(partial: Partial<FinanzasPlantillaItem>): FinanzasPlantillaItem {
  return {
    id: 10,
    user_id: 1,
    tipo: 'egreso',
    fecha_creacion: '',
    estado: 'pendiente',
    mes: 5,
    anio: 2026,
    eliminado: false,
    nombre: 'Arriendo',
    monto: 600,
    ...partial,
  };
}

describe('MovimientoRow', () => {
  let component: MovimientoRow;
  let fixture: ComponentFixture<MovimientoRow>;
  let el: HTMLElement;
  const emitted: Record<string, unknown[]> = {};

  const byTitle = (title: string) => el.querySelector(`[title="${title}"]`) as HTMLElement;
  const render = async (patch: Partial<FinanzasPlantillaItem> = {}) => {
    fixture.componentRef.setInput('movimiento', item(patch));
    await fixture.whenStable();
  };
  const stopEvent = () => ({ stopPropagation: vi.fn() }) as unknown as Event;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MovimientoRow] }).compileComponents();
    fixture = TestBed.createComponent(MovimientoRow);
    component = fixture.componentInstance;
    el = fixture.nativeElement;

    for (const name of [
      'selectToggle',
      'menuToggle',
      'estadoChange',
      'nombreChange',
      'montoChange',
      'edit',
      'remove',
    ] as const) {
      emitted[name] = [];
      (component[name] as { subscribe: (fn: (v: unknown) => void) => void }).subscribe((v) =>
        emitted[name].push(v),
      );
    }
    await render();
  });

  it('should render nombre, estado and monto', () => {
    expect(byTitle('Clic para editar concepto rápidamente').textContent).toContain('Arriendo');
    expect(el.textContent).toContain('Pendiente');
    expect(byTitle('Clic para editar monto rápidamente').textContent).toMatch(/600/);
  });

  it('should be a block element so the list dividers apply', () => {
    expect(el.classList).toContain('block');
  });

  it('clicking the estado pill should emit the next estado', async () => {
    byTitle('Estado actual: pendiente. Clic para cambiar al siguiente estado').click();
    await render({ estado: 'en proceso' });
    byTitle('Estado actual: en proceso. Clic para cambiar al siguiente estado').click();
    expect(emitted['estadoChange']).toEqual(['en proceso', 'completado']);
  });

  it('should show the estado menu only when menuOpen and emit the chosen estado', async () => {
    expect(el.textContent).not.toContain('En Proceso');
    byTitle('Elegir estado específico').click();
    expect(emitted['menuToggle'].length).toBe(1);

    fixture.componentRef.setInput('menuOpen', true);
    await fixture.whenStable();
    const enProceso = [...el.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'En Proceso',
    ) as HTMLButtonElement;
    enProceso.click();
    expect(emitted['estadoChange']).toEqual(['en proceso' as EstadoFinanzas]);
  });

  it('should hide badges that repeat the grouping', async () => {
    await render({ grupo_item_nombre: 'Casa', movimiento_esperado_nombre: 'PAC' });
    expect(el.textContent).not.toContain('Casa');
    expect(el.textContent).toContain('PAC');
    fixture.componentRef.setInput('groupMode', 'mecanismo');
    await fixture.whenStable();
    expect(el.textContent).toContain('Casa');
    expect(el.textContent).not.toContain('PAC');
  });

  it('selection checkbox, edit and remove should emit and stop propagation', () => {
    const event = stopEvent();
    component.onToggleSelect(event);
    component.onEdit(event);
    component.onRemove(event);
    expect(event.stopPropagation).toHaveBeenCalledTimes(3);
    expect(emitted['selectToggle'].length).toBe(1);
    expect(emitted['edit'].length).toBe(1);
    expect(emitted['remove'].length).toBe(1);
  });

  it('rowClass should reflect selection', async () => {
    fixture.componentRef.setInput('selected', true);
    await fixture.whenStable();
    expect(el.querySelector('div')!.className).toContain('bg-primary/10');
  });

  describe('inline nombre', () => {
    it('should emit a trimmed new name', () => {
      component.startNombre();
      expect(component.editingNombreValue()).toBe('Arriendo');
      component.editingNombreValue.set('  Dividendo ');
      component.saveNombre();
      expect(emitted['nombreChange']).toEqual(['Dividendo']);
      expect(component.editingNombre()).toBe(false);
    });

    it('should skip empty or unchanged names', () => {
      component.startNombre();
      component.editingNombreValue.set('   ');
      component.saveNombre();
      component.startNombre();
      component.saveNombre();
      expect(emitted['nombreChange']).toEqual([]);
      expect(component.editingNombre()).toBe(false);
    });

    it('should ignore saves when not editing (e.g. blur after escape)', () => {
      component.startNombre();
      component.editingNombreValue.set('Otro');
      component.cancelNombre();
      component.saveNombre();
      expect(emitted['nombreChange']).toEqual([]);
      expect(component.editingNombreValue()).toBe('');
    });
  });

  describe('inline monto', () => {
    it('should start editing with the current monto', () => {
      component.startMonto();
      expect(component.editingMonto()).toBe(true);
      expect(component.editingMontoValue()).toBe(600);
    });

    it('should emit a changed monto', () => {
      component.startMonto();
      component.editingMontoValue.set(750);
      component.saveMonto();
      expect(emitted['montoChange']).toEqual([750]);
      expect(component.editingMonto()).toBe(false);
    });

    it('should not emit when value is unchanged or null', () => {
      component.startMonto();
      component.saveMonto();
      expect(component.editingMonto()).toBe(false);

      component.startMonto();
      component.editingMontoValue.set(null);
      component.saveMonto();
      expect(emitted['montoChange']).toEqual([]);
    });

    it('cancelMonto should reset state and ignore a later blur', () => {
      component.startMonto();
      component.editingMontoValue.set(750);
      component.cancelMonto();
      component.saveMonto();
      expect(component.editingMontoValue()).toBeNull();
      expect(emitted['montoChange']).toEqual([]);
    });
  });
});
