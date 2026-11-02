import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ClonarPeriodoModal } from './clonar-periodo-modal';
import { FinanzasService } from '../../data/finanzas.service';
import { ToastService } from '../../../../shared/services/toast.service';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

describe('ClonarPeriodoModal', () => {
  let component: ClonarPeriodoModal;
  let fixture: ComponentFixture<ClonarPeriodoModal>;
  let finanzas: { clonarPeriodo: ReturnType<typeof vi.fn> };
  let toast: ToastService;
  let clonedSpy: import('vitest').Mock<(v: { mes: number; anio: number }) => void>;

  beforeEach(async () => {
    finanzas = { clonarPeriodo: vi.fn().mockReturnValue(of({ registros_clonados: 4 })) };

    await TestBed.configureTestingModule({
      imports: [ClonarPeriodoModal],
      providers: [{ provide: FinanzasService, useValue: finanzas }],
    }).compileComponents();

    fixture = TestBed.createComponent(ClonarPeriodoModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mes', 5);
    fixture.componentRef.setInput('anio', 2026);
    fixture.componentRef.setInput('meses', MESES);

    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clonedSpy = vi.fn<(v: { mes: number; anio: number }) => void>();
    component.cloned.subscribe((v) => clonedSpy(v));
    await fixture.whenStable();
  });

  it('open should default destination to next month', () => {
    component.open();
    expect(component.cloneMesOrigen()).toBe(5);
    expect(component.cloneAnioOrigen()).toBe(2026);
    expect(component.cloneMesDestino()).toBe(6);
    expect(component.cloneAnioDestino()).toBe(2026);
    expect(component.showCloneModal()).toBe(true);
  });

  it('open should roll December to January of next year', () => {
    fixture.componentRef.setInput('mes', 12);
    component.open();
    expect(component.cloneMesDestino()).toBe(1);
    expect(component.cloneAnioDestino()).toBe(2027);
  });

  it('submitClone should clone, close the modal and emit cloned', () => {
    component.open();
    component.submitClone();
    expect(finanzas.clonarPeriodo).toHaveBeenCalledWith({
      anio_origen: 2026,
      mes_origen: 5,
      anio_destino: 2026,
      mes_destino: 6,
    });
    expect(toast.success).toHaveBeenCalledWith('¡Éxito! Se clonaron 4 movimientos a Junio 2026');
    expect(component.showCloneModal()).toBe(false);
    expect(component.isSubmittingClone()).toBe(false);
    expect(clonedSpy).toHaveBeenCalledWith({ mes: 6, anio: 2026 });
  });

  it('submitClone should coerce string values to numbers', () => {
    component.open();
    component.cloneMesDestino.set('7' as unknown as number);
    component.submitClone();
    expect(finanzas.clonarPeriodo).toHaveBeenCalledWith(
      expect.objectContaining({ mes_destino: 7 }),
    );
  });

  it('submitClone should toast the backend error and keep modal open', () => {
    finanzas.clonarPeriodo.mockReturnValue(throwError(() => ({ error: 'ya existe' })));
    component.open();
    component.submitClone();
    expect(toast.error).toHaveBeenCalledWith('Error al clonar el período: ya existe');
    expect(component.showCloneModal()).toBe(true);
    expect(component.isSubmittingClone()).toBe(false);
    expect(clonedSpy).not.toHaveBeenCalled();
  });

  it('closeCloneModal should hide the modal', () => {
    component.open();
    component.closeCloneModal();
    expect(component.showCloneModal()).toBe(false);
  });
});
