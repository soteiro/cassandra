import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { MovimientoFormModal } from './movimiento-form-modal';
import { FinanzasService } from '../../data/finanzas.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { FinanzasPlantillaItem } from '../../data/finanzas.model';

function item(partial: Partial<FinanzasPlantillaItem>): FinanzasPlantillaItem {
  return {
    id: 1,
    user_id: 1,
    tipo: 'egreso',
    fecha_creacion: '',
    estado: 'pendiente',
    mes: 5,
    anio: 2026,
    eliminado: false,
    nombre: 'x',
    monto: 0,
    ...partial,
  };
}

const arriendo = item({
  id: 10,
  nombre: 'Arriendo',
  monto: 600,
  estado: 'completado',
  grupo_item_id: 100,
  banco_id: 1,
  movimiento_esperado_id: 7,
});
const cafe = item({ id: 13, nombre: 'Café', monto: 50 });

describe('MovimientoFormModal', () => {
  let component: MovimientoFormModal;
  let fixture: ComponentFixture<MovimientoFormModal>;
  let finanzas: Record<string, ReturnType<typeof vi.fn>>;
  let toast: ToastService;
  let savedSpy: import('vitest').Mock<() => void>;

  beforeEach(async () => {
    finanzas = {
      updatePlantillaItem: vi.fn().mockReturnValue(of({})),
      createPlantillaItem: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [MovimientoFormModal],
      providers: [{ provide: FinanzasService, useValue: finanzas }],
    }).compileComponents();

    fixture = TestBed.createComponent(MovimientoFormModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mes', 5);
    fixture.componentRef.setInput('anio', 2026);

    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    savedSpy = vi.fn<() => void>();
    component.saved.subscribe(() => savedSpy());
    await fixture.whenStable();
  });

  it('openCreate should reset the form with the given tipo', () => {
    component.formNombre.set('old');
    component.openCreate('ingreso');
    expect(component.showItemModal()).toBe(true);
    expect(component.isEditingItem()).toBe(false);
    expect(component.formTipo()).toBe('ingreso');
    expect(component.formNombre()).toBe('');
    expect(component.formEstado()).toBe('pendiente');
  });

  it('openEdit should populate the form from the item', () => {
    component.openEdit(arriendo);
    expect(component.isEditingItem()).toBe(true);
    expect(component.editingItemId()).toBe(10);
    expect(component.formNombre()).toBe('Arriendo');
    expect(component.formMonto()).toBe(600);
    expect(component.formBancoId()).toBe(1);
    expect(component.formGrupoItemId()).toBe(100);
    expect(component.formMovimientoEsperadoId()).toBe(7);
    expect(component.formEstado()).toBe('completado');
  });

  it('openEdit should map undefined relations to null', () => {
    component.openEdit(cafe);
    expect(component.formBancoId()).toBeNull();
    expect(component.formGrupoItemId()).toBeNull();
    expect(component.formMovimientoEsperadoId()).toBeNull();
  });

  it('should render only while open', async () => {
    expect(fixture.nativeElement.textContent).not.toContain('Nuevo Movimiento');
    component.openCreate();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Nuevo Movimiento');
  });

  it('closeItemModal should reset editing state', () => {
    component.openEdit(arriendo);
    component.closeItemModal();
    expect(component.showItemModal()).toBe(false);
    expect(component.isEditingItem()).toBe(false);
    expect(component.editingItemId()).toBeNull();
  });

  it('saveItem should require a name', () => {
    component.openCreate();
    component.saveItem();
    expect(toast.error).toHaveBeenCalledWith('El nombre del movimiento es obligatorio');
    expect(finanzas['createPlantillaItem']).not.toHaveBeenCalled();
  });

  it('saveItem should create an egreso including categoría and mecanismo', () => {
    component.openCreate('egreso');
    component.formNombre.set(' Gas ');
    component.formMonto.set(40);
    component.formBancoId.set(1);
    component.formGrupoItemId.set(100);
    component.formMovimientoEsperadoId.set(7);
    component.saveItem();
    expect(finanzas['createPlantillaItem']).toHaveBeenCalledWith({
      tipo: 'egreso',
      nombre: 'Gas',
      monto: 40,
      mes: 5,
      anio: 2026,
      estado: 'pendiente',
      banco_id: 1,
      grupo_item_id: 100,
      movimiento_esperado_id: 7,
    });
    expect(toast.success).toHaveBeenCalledWith('Movimiento creado');
    expect(component.showItemModal()).toBe(false);
    expect(component.isSubmittingItem()).toBe(false);
    expect(savedSpy).toHaveBeenCalled();
  });

  it('saveItem should drop categoría/mecanismo for ingresos and default monto to 0', () => {
    component.openCreate('ingreso');
    component.formNombre.set('Bono');
    component.formGrupoItemId.set(100);
    component.formMovimientoEsperadoId.set(7);
    component.saveItem();
    expect(finanzas['createPlantillaItem']).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'ingreso',
        monto: 0,
        grupo_item_id: null,
        movimiento_esperado_id: null,
      }),
    );
  });

  it('saveItem should toast on create error and keep modal open', () => {
    finanzas['createPlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
    component.openCreate();
    component.formNombre.set('Gas');
    component.saveItem();
    expect(toast.error).toHaveBeenCalledWith('Error al crear movimiento');
    expect(component.showItemModal()).toBe(true);
    expect(component.isSubmittingItem()).toBe(false);
    expect(savedSpy).not.toHaveBeenCalled();
  });

  it('saveItem should update when editing', () => {
    component.openEdit(arriendo);
    component.formMonto.set(650);
    component.saveItem();
    expect(finanzas['updatePlantillaItem']).toHaveBeenCalledWith(10, {
      nombre: 'Arriendo',
      monto: 650,
      tipo: 'egreso',
      banco_id: 1,
      grupo_item_id: 100,
      movimiento_esperado_id: 7,
      estado: 'completado',
      mes: 5,
      anio: 2026,
    });
    expect(toast.success).toHaveBeenCalledWith('Movimiento actualizado');
    expect(component.showItemModal()).toBe(false);
    expect(savedSpy).toHaveBeenCalled();
  });

  it('saveItem should toast on update error', () => {
    finanzas['updatePlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
    component.openEdit(arriendo);
    component.saveItem();
    expect(toast.error).toHaveBeenCalledWith('Error al actualizar movimiento');
    expect(component.isSubmittingItem()).toBe(false);
  });

  it('saveItem while editing without id should show an error and not get stuck submitting', () => {
    component.isEditingItem.set(true);
    component.editingItemId.set(null);
    component.formNombre.set('x');
    component.saveItem();
    expect(finanzas['updatePlantillaItem']).not.toHaveBeenCalled();
    expect(component.isSubmittingItem()).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('No se encontró el movimiento a editar');
  });
});
