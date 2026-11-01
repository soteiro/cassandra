import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { MovimientoQuickAdd } from './movimiento-quick-add';
import { FinanzasService } from '../../data/finanzas.service';
import { ToastService } from '../../../../shared/services/toast.service';

describe('MovimientoQuickAdd', () => {
  let component: MovimientoQuickAdd;
  let fixture: ComponentFixture<MovimientoQuickAdd>;
  let finanzas: { createPlantillaItem: ReturnType<typeof vi.fn> };
  let toast: ToastService;
  let createdSpy: import('vitest').Mock<() => void>;

  beforeEach(async () => {
    finanzas = { createPlantillaItem: vi.fn().mockReturnValue(of({})) };

    await TestBed.configureTestingModule({
      imports: [MovimientoQuickAdd],
      providers: [{ provide: FinanzasService, useValue: finanzas }],
    }).compileComponents();

    fixture = TestBed.createComponent(MovimientoQuickAdd);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mes', 5);
    fixture.componentRef.setInput('anio', 2026);

    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createdSpy = vi.fn<() => void>();
    component.created.subscribe(() => createdSpy());
    await fixture.whenStable();
  });

  it('should ignore blank names', () => {
    component.quickNombre.set('  ');
    component.createQuick();
    expect(finanzas.createPlantillaItem).not.toHaveBeenCalled();
  });

  it('should create a pending egreso and reset fields', () => {
    component.quickNombre.set(' Pan ');
    component.quickMonto.set(2);
    component.quickBancoId.set(1);
    component.quickGrupoId.set(200);
    component.createQuick();
    expect(finanzas.createPlantillaItem).toHaveBeenCalledWith({
      tipo: 'egreso',
      nombre: 'Pan',
      monto: 2,
      mes: 5,
      anio: 2026,
      estado: 'pendiente',
      banco_id: 1,
      grupo_item_id: 200,
    });
    expect(toast.success).toHaveBeenCalledWith('Movimiento agregado');
    expect(component.quickNombre()).toBe('');
    expect(component.quickMonto()).toBeNull();
    expect(component.isSubmittingQuick()).toBe(false);
    expect(createdSpy).toHaveBeenCalled();
  });

  it('should drop grupo for ingresos', () => {
    component.quickTipo.set('ingreso');
    component.quickNombre.set('Venta');
    component.quickGrupoId.set(200);
    component.createQuick();
    expect(finanzas.createPlantillaItem).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'ingreso', grupo_item_id: null, monto: 0 }),
    );
  });

  it('should toast on error and keep the name', () => {
    finanzas.createPlantillaItem.mockReturnValue(throwError(() => new Error('x')));
    component.quickNombre.set('Pan');
    component.createQuick();
    expect(toast.error).toHaveBeenCalledWith('Error al crear movimiento');
    expect(component.quickNombre()).toBe('Pan');
    expect(component.isSubmittingQuick()).toBe(false);
    expect(createdSpy).not.toHaveBeenCalled();
  });

  it('status filter buttons should update the two-way bound model', () => {
    const changes: string[] = [];
    component.statusFilter.subscribe((v) => changes.push(v));
    const boton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim() === 'Pendientes',
    ) as HTMLButtonElement;
    boton.click();
    expect(component.statusFilter()).toBe('pendientes');
    expect(changes).toEqual(['pendientes']);
  });
});
