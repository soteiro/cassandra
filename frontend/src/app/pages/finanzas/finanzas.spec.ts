import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Finanzas } from './finanzas';
import { FinanzasService } from '../../services/finanzas.service';
import { ToastService } from '../../services/toast.service';
import { FinanzasPlantillaItem } from '../../models/finanzas.model';

function item(partial: Partial<FinanzasPlantillaItem>): FinanzasPlantillaItem {
  return {
    id: 1,
    user_id: 1,
    tipo: 'egreso',
    fecha_creacion: '',
    estado: 'pendiente',
    mes: 1,
    anio: 2026,
    eliminado: false,
    nombre: 'x',
    monto: 0,
    ...partial,
  };
}

describe('Finanzas', () => {
  let component: Finanzas;
  let fixture: ComponentFixture<Finanzas>;
  let finanzas: Record<string, ReturnType<typeof vi.fn>>;
  let toast: ToastService;

  const plantilla = [
    item({ id: 1, tipo: 'ingreso', monto: 1000 }),
    item({ id: 2, tipo: 'egreso', monto: 300 }),
    item({ id: 3, tipo: 'egreso', monto: 200 }),
  ];
  const resumen = { mes: 5, anio: 2026, total_ingresos: 1000, total_egresos: 500, balance: 500 };

  beforeEach(async () => {
    finanzas = {
      getBancos: vi.fn().mockReturnValue(of([{ id: 1, nombre: 'BCI' }])),
      getGrupos: vi.fn().mockReturnValue(of([{ id: 2, nombre: 'Comida' }])),
      getMovimientosEsperados: vi.fn().mockReturnValue(of([{ id: 3, nombre: 'PAC' }])),
      getPlantilla: vi.fn().mockReturnValue(of(plantilla)),
      getResumen: vi.fn().mockReturnValue(of(resumen)),
      getListaDeseos: vi.fn().mockReturnValue(
        of([
          { id: 1, comprado: false },
          { id: 2, comprado: true },
          { id: 3, comprado: false },
        ])
      ),
    };

    await TestBed.configureTestingModule({
      imports: [Finanzas],
      providers: [provideRouter([]), { provide: FinanzasService, useValue: finanzas }],
    }).compileComponents();

    fixture = TestBed.createComponent(Finanzas);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'error');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load catalogs, periodo and deseos count on init', () => {
    expect(component.bancos().length).toBe(1);
    expect(component.grupos().length).toBe(1);
    expect(component.movimientosEsperados().length).toBe(1);
    expect(component.items()).toEqual(plantilla);
    expect(component.resumen()).toEqual(resumen);
    expect(component.deseosPendientesCount()).toBe(2);
    expect(component.isLoading()).toBe(false);
    expect(finanzas['getPlantilla']).toHaveBeenCalledWith(
      component.selectedAnio(),
      component.selectedMes()
    );
  });

  it('should split ingresos and egresos', () => {
    expect(component.ingresos().map((i) => i.id)).toEqual([1]);
    expect(component.egresos().map((i) => i.id)).toEqual([2, 3]);
  });

  describe('porcentajeReal', () => {
    it('should be egresos / ingresos rounded', () => {
      expect(component.porcentajeReal()).toBe(50);
      component.resumen.set({ ...resumen, total_ingresos: 3, total_egresos: 1 });
      expect(component.porcentajeReal()).toBe(33);
    });

    it('should be 100 when there are egresos but no ingresos', () => {
      component.resumen.set({ ...resumen, total_ingresos: 0, total_egresos: 10 });
      expect(component.porcentajeReal()).toBe(100);
    });

    it('should be 0 when there is nothing', () => {
      component.resumen.set({ ...resumen, total_ingresos: 0, total_egresos: 0 });
      expect(component.porcentajeReal()).toBe(0);
    });
  });

  it('mesNombre should reflect the selected month', () => {
    component.selectedMes.set(3);
    expect(component.mesNombre()).toBe('Marzo');
  });

  describe('month navigation', () => {
    it('prevMonth should wrap January to December of the previous year', () => {
      component.setPeriodo(1, 2026);
      component.prevMonth();
      expect(component.selectedMes()).toBe(12);
      expect(component.selectedAnio()).toBe(2025);
      expect(finanzas['getPlantilla']).toHaveBeenLastCalledWith(2025, 12);
    });

    it('prevMonth should decrement within the year', () => {
      component.setPeriodo(6, 2026);
      component.prevMonth();
      expect(component.selectedMes()).toBe(5);
      expect(component.selectedAnio()).toBe(2026);
    });

    it('nextMonth should wrap December to January of the next year', () => {
      component.setPeriodo(12, 2026);
      component.nextMonth();
      expect(component.selectedMes()).toBe(1);
      expect(component.selectedAnio()).toBe(2027);
      expect(finanzas['getResumen']).toHaveBeenLastCalledWith(2027, 1);
    });

    it('goToCurrentMonth should go back to today', () => {
      component.setPeriodo(1, 1999);
      component.goToCurrentMonth();
      const now = new Date();
      expect(component.selectedMes()).toBe(now.getMonth() + 1);
      expect(component.selectedAnio()).toBe(now.getFullYear());
    });

    it('onPeriodoChanged should set the periodo and reload', () => {
      component.onPeriodoChanged({ mes: 8, anio: 2030 });
      expect(component.selectedMes()).toBe(8);
      expect(component.selectedAnio()).toBe(2030);
      expect(finanzas['getPlantilla']).toHaveBeenLastCalledWith(2030, 8);
    });
  });

  describe('loadPeriodo errors / empty responses', () => {
    it('should toast and stop loading when the plantilla fails', () => {
      finanzas['getPlantilla'].mockReturnValue(throwError(() => new Error('x')));
      component.loadPeriodo();
      expect(toast.error).toHaveBeenCalledWith('Error al cargar movimientos del período');
      expect(component.isLoading()).toBe(false);
    });

    it('should default items and resumen when the API returns null', () => {
      finanzas['getPlantilla'].mockReturnValue(of(null));
      finanzas['getResumen'].mockReturnValue(of(null));
      component.setPeriodo(4, 2026);
      expect(component.items()).toEqual([]);
      expect(component.resumen()).toEqual({
        mes: 4,
        anio: 2026,
        total_ingresos: 0,
        total_egresos: 0,
        balance: 0,
      });
    });

    it('should not throw when catalogs fail', () => {
      finanzas['getBancos'].mockReturnValue(throwError(() => new Error('x')));
      finanzas['getGrupos'].mockReturnValue(throwError(() => new Error('x')));
      finanzas['getMovimientosEsperados'].mockReturnValue(throwError(() => new Error('x')));
      vi.mocked(console.error).mockClear();
      expect(() => component.loadCatalogs()).not.toThrow();
      expect(console.error).toHaveBeenCalledTimes(3);
    });
  });

  it('reload should refetch everything and toggle isRotating', () => {
    vi.useFakeTimers();
    try {
      finanzas['getBancos'].mockClear();
      finanzas['getPlantilla'].mockClear();
      finanzas['getListaDeseos'].mockClear();
      component.reload();
      expect(component.isRotating()).toBe(true);
      expect(finanzas['getBancos']).toHaveBeenCalled();
      expect(finanzas['getPlantilla']).toHaveBeenCalled();
      expect(finanzas['getListaDeseos']).toHaveBeenCalled();
      vi.advanceTimersByTime(600);
      expect(component.isRotating()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('formatCurrency should format CLP without decimals', () => {
    expect(component.formatCurrency(1234567)).toMatch(/1\.234\.567/);
  });
});
