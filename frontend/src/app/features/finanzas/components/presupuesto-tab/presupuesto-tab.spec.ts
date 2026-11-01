import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PresupuestoTab } from './presupuesto-tab';
import { FinanzasService } from '../../data/finanzas.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { FinanzasPlantillaItem } from '../../data/finanzas.model';
import { FinanzasGroup } from '../../utils/presupuesto.util';
import { MovimientoFormModal } from '../movimiento-form-modal/movimiento-form-modal';
import { ClonarPeriodoModal } from '../clonar-periodo-modal/clonar-periodo-modal';
import { MovimientoQuickAdd } from '../movimiento-quick-add/movimiento-quick-add';

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

function buildItems(): FinanzasPlantillaItem[] {
  return [
    item({
      id: 1,
      tipo: 'ingreso',
      nombre: 'Sueldo',
      monto: 2000,
      estado: 'completado',
      banco_id: 1,
      banco_nombre: 'BCI',
    }),
    item({ id: 2, tipo: 'ingreso', nombre: 'Freelance', monto: 500, estado: 'pendiente' }),
    item({
      id: 10,
      nombre: 'Arriendo',
      monto: 600,
      estado: 'completado',
      grupo_item_id: 100,
      grupo_item_nombre: 'Casa',
      banco_id: 1,
      banco_nombre: 'BCI',
      movimiento_esperado_id: 7,
      movimiento_esperado_nombre: 'PAC',
    }),
    item({
      id: 11,
      nombre: 'Luz',
      monto: 100,
      estado: 'en proceso',
      grupo_item_id: 100,
      grupo_item_nombre: 'Casa',
    }),
    item({
      id: 12,
      nombre: 'Supermercado',
      monto: 300,
      estado: 'pendiente',
      grupo_item_id: 200,
      grupo_item_nombre: 'Comida',
      banco_id: 2,
      banco_nombre: 'Santander',
    }),
    item({ id: 13, nombre: 'Café', monto: 50, estado: 'pendiente' }),
  ];
}

describe('PresupuestoTab', () => {
  let component: PresupuestoTab;
  let fixture: ComponentFixture<PresupuestoTab>;
  let el: HTMLElement;
  let finanzas: Record<string, ReturnType<typeof vi.fn>>;
  let toast: ToastService;
  let reloadSpy: import('vitest').Mock<() => void>;
  let periodoSpy: import('vitest').Mock<(v: { mes: number; anio: number }) => void>;
  let items: FinanzasPlantillaItem[];

  /** Versión actual del ítem en la copia local del componente. */
  const local = (id: number) => component.localItems().find((i) => i.id === id)!;
  const child = <T>(type: new (...args: never[]) => T): T =>
    fixture.debugElement.query(By.directive(type)).componentInstance as T;

  beforeEach(async () => {
    finanzas = {
      updatePlantillaItem: vi.fn().mockReturnValue(of({})),
      createPlantillaItem: vi.fn().mockReturnValue(of({})),
      deletePlantillaItem: vi.fn().mockReturnValue(of(undefined)),
      batchUpdateEstado: vi.fn().mockReturnValue(of({})),
      batchDelete: vi.fn().mockReturnValue(of({})),
      batchUpdateCategoria: vi.fn().mockReturnValue(of({})),
      batchUpdateBanco: vi.fn().mockReturnValue(of({})),
      clonarPeriodo: vi.fn().mockReturnValue(of({ registros_clonados: 4 })),
    };

    await TestBed.configureTestingModule({
      imports: [PresupuestoTab],
      providers: [provideRouter([]), { provide: FinanzasService, useValue: finanzas }],
    }).compileComponents();

    fixture = TestBed.createComponent(PresupuestoTab);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    items = buildItems();
    fixture.componentRef.setInput('selectedAnio', 2026);
    fixture.componentRef.setInput('selectedMes', 5);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('grupos', [
      { id: 100, user_id: 1, nombre: 'Casa', fecha_creacion: '', eliminado: false },
    ]);
    fixture.componentRef.setInput('bancos', [
      { id: 1, user_id: 1, nombre: 'BCI', tipo: 'debito', fecha_creacion: '', eliminado: false },
    ]);

    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reloadSpy = vi.fn<() => void>();
    periodoSpy = vi.fn<(v: { mes: number; anio: number }) => void>();
    component.reload.subscribe(() => reloadSpy());
    component.periodoChange.subscribe((v) => periodoSpy(v));
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ==========================================
  describe('filters and grouping', () => {
    it('should split items by tipo', () => {
      expect(component.ingresos().map((i) => i.id)).toEqual([1, 2]);
      expect(component.egresos().map((i) => i.id)).toEqual([10, 11, 12, 13]);
    });

    it('should apply the search input and the status filter', () => {
      fixture.componentRef.setInput('searchQuery', 'casa');
      expect(component.egresos().map((i) => i.id)).toEqual([10, 11]);
      component.statusFilter.set('completados');
      expect(component.egresos().map((i) => i.id)).toEqual([10]);
    });

    it('the quick-add status buttons should drive the filter', async () => {
      child(MovimientoQuickAdd).statusFilter.set('pendientes');
      await fixture.whenStable();
      expect(component.statusFilter()).toBe('pendientes');
      expect(component.egresos().map((i) => i.id)).toEqual([12, 13]);
    });

    it('should group by the selected mode', () => {
      expect(component.groupedEgresos().map((g) => g.key)).toEqual([
        'cat_100',
        'cat_200',
        'sin_categoria',
      ]);
      component.groupMode.set('banco');
      expect(component.groupedEgresos().map((g) => g.key)).toEqual([
        'banco_1',
        'banco_2',
        'sin_banco',
      ]);
    });

    it('currentGroupedList should follow the sub tab', () => {
      expect(component.currentGroupedList()).toBe(component.groupedEgresos());
      component.movimientosSubTab.set('ingresos');
      expect(component.currentGroupedList()).toBe(component.groupedIngresos());
    });

    it('should toggle, expand and collapse groups', () => {
      component.toggleGroupCollapse('cat_100');
      expect(component.isGroupCollapsed('cat_100')).toBe(true);
      component.toggleGroupCollapse('cat_100');
      expect(component.isGroupCollapsed('cat_100')).toBe(false);

      component.collapseAllGroups();
      expect([...component.collapsedGroups()].sort()).toEqual(
        ['cat_100', 'cat_200', 'sin_categoria'].sort(),
      );
      component.expandAllGroups();
      expect(component.collapsedGroups().size).toBe(0);
    });

    it('should render one row per visible egreso', () => {
      expect(el.querySelectorAll('app-movimiento-row').length).toBe(4);
    });
  });

  // ==========================================
  describe('multi selection', () => {
    it('should toggle a single item', () => {
      component.toggleSelectItem(10);
      expect(component.isItemSelected(10)).toBe(true);
      expect(component.selectedCount()).toBe(1);
      component.toggleSelectItem(10);
      expect(component.isItemSelected(10)).toBe(false);
    });

    it('checking a row should select it and show the bulk bar', async () => {
      expect(el.querySelector('app-bulk-actions-bar')).toBeNull();
      (el.querySelector('[title="Seleccionar para acciones en lote"]') as HTMLInputElement).click();
      await fixture.whenStable();
      expect(component.selectedCount()).toBe(1);
      expect(el.querySelector('app-bulk-actions-bar')).not.toBeNull();
    });

    it('selectedTotalMonto should sum selected items', () => {
      component.toggleSelectItem(10);
      component.toggleSelectItem(12);
      component.toggleSelectItem(1);
      expect(component.selectedTotalMonto()).toBe(2900);
    });

    it('should select/deselect a whole group and report partial state', () => {
      const casa = component.groupedEgresos().find((g) => g.key === 'cat_100') as FinanzasGroup;
      expect(component.isGroupAllSelected(casa)).toBe(false);
      expect(component.isGroupSomeSelected(casa)).toBe(false);

      component.toggleSelectItem(10);
      expect(component.isGroupSomeSelected(casa)).toBe(true);
      expect(component.isGroupAllSelected(casa)).toBe(false);

      component.toggleSelectGroup(casa);
      expect(component.isGroupAllSelected(casa)).toBe(true);
      expect(component.isGroupSomeSelected(casa)).toBe(false);

      component.toggleSelectGroup(casa);
      expect(component.selectedCount()).toBe(0);
    });

    it('isGroupAllSelected should be false for an empty group', () => {
      const empty: FinanzasGroup = {
        key: 'e',
        title: 'e',
        items: [],
        total: 0,
        totalCompletado: 0,
        totalEnProceso: 0,
        totalPendiente: 0,
        porcentajeCompletado: 0,
      };
      expect(component.isGroupAllSelected(empty)).toBe(false);
    });

    it('toggleSelectAllVisible should use the active sub tab and respect filters', () => {
      component.statusFilter.set('pendientes');
      component.toggleSelectAllVisible();
      expect([...component.selectedIds()].sort()).toEqual([12, 13]);
      expect(component.isAllVisibleSelected()).toBe(true);

      component.toggleSelectAllVisible();
      expect(component.selectedCount()).toBe(0);

      component.movimientosSubTab.set('ingresos');
      component.statusFilter.set('all');
      component.toggleSelectItem(1);
      expect(component.isSomeVisibleSelected()).toBe(true);
      expect(component.isAllVisibleSelected()).toBe(false);
      component.toggleSelectAllVisible();
      expect([...component.selectedIds()].sort()).toEqual([1, 2]);
    });

    it('isAllVisibleSelected should be false with no visible items', () => {
      fixture.componentRef.setInput('items', []);
      expect(component.isAllVisibleSelected()).toBe(false);
    });

    it('clearSelection should reset selection', () => {
      component.toggleSelectItem(10);
      component.clearSelection();
      expect(component.selectedCount()).toBe(0);
    });

    it('document click should close the estado menu', () => {
      component.statusMenuOpenId.set(10);
      document.dispatchEvent(new MouseEvent('click'));
      expect(component.statusMenuOpenId()).toBeNull();
    });
  });

  // ==========================================
  describe('estado changes', () => {
    it('clicking a row estado pill should cycle pendiente -> en proceso -> completado -> pendiente', async () => {
      const pill = () =>
        el
          .querySelectorAll('app-movimiento-row')[2]
          .querySelector('[title^="Estado actual"]') as HTMLButtonElement;
      // Sin agrupar, la tercera fila es Supermercado (id 12, pendiente); cada clic usa la versión ya actualizada.
      component.groupMode.set('ninguno');
      await fixture.whenStable();
      for (const esperado of ['en proceso', 'completado', 'pendiente']) {
        pill().click();
        await fixture.whenStable();
        expect(finanzas['updatePlantillaItem']).toHaveBeenLastCalledWith(12, { estado: esperado });
      }
      expect(reloadSpy).toHaveBeenCalledTimes(3);
    });

    it('setItemEstado should be a no-op when estado is unchanged but still close the menu', () => {
      component.statusMenuOpenId.set(10);
      component.setItemEstado(items[2], 'completado');
      expect(finanzas['updatePlantillaItem']).not.toHaveBeenCalled();
      expect(component.statusMenuOpenId()).toBeNull();
    });

    it('setItemEstado should optimistically update without mutating the input and toast on success', () => {
      component.setItemEstado(items[5], 'completado');
      expect(local(items[5].id).estado).toBe('completado');
      expect(items[5].estado).toBe('pendiente');
      expect(toast.success).toHaveBeenCalledWith('"Café" marcado como completado');
    });

    it('setItemEstado should revert on error', () => {
      finanzas['updatePlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
      component.setItemEstado(items[5], 'completado');
      expect(local(items[5].id).estado).toBe('pendiente');
      expect(toast.error).toHaveBeenCalledWith('Error al actualizar estado');
      expect(reloadSpy).not.toHaveBeenCalled();
    });

    it('optimistic changes should recompute the filtered lists and be reset by a new items input', () => {
      component.statusFilter.set('completados');
      const before = component.egresos().length + component.ingresos().length;
      component.setItemEstado(items[5], 'completado');
      expect(component.egresos().length + component.ingresos().length).toBe(before + 1);

      fixture.componentRef.setInput('items', buildItems());
      expect(local(items[5].id).estado).toBe('pendiente');
    });

    it('toggleStatusMenu should open and close the menu for an id', () => {
      component.toggleStatusMenu(10);
      expect(component.statusMenuOpenId()).toBe(10);
      component.toggleStatusMenu(10);
      expect(component.statusMenuOpenId()).toBeNull();
    });
  });

  // ==========================================
  describe('inline edits from a row', () => {
    it('updateMonto should update optimistically and reload', () => {
      component.updateMonto(items[2], 750);
      expect(finanzas['updatePlantillaItem']).toHaveBeenCalledWith(10, { monto: 750 });
      expect(local(10).monto).toBe(750);
      expect(items[2].monto).toBe(600);
      expect(toast.success).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('updateMonto should revert on error and still reload', () => {
      finanzas['updatePlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
      component.updateMonto(items[2], 750);
      expect(local(10).monto).toBe(600);
      expect(toast.error).toHaveBeenCalledWith('Error al actualizar monto');
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('updateNombre should update optimistically without reloading', () => {
      component.updateNombre(items[2], 'Dividendo');
      expect(finanzas['updatePlantillaItem']).toHaveBeenCalledWith(10, { nombre: 'Dividendo' });
      expect(local(10).nombre).toBe('Dividendo');
      expect(items[2].nombre).toBe('Arriendo');
      expect(toast.success).toHaveBeenCalledWith('Concepto actualizado');
      expect(reloadSpy).not.toHaveBeenCalled();
    });

    it('updateNombre should revert on error', () => {
      finanzas['updatePlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
      component.updateNombre(items[2], 'Otro');
      expect(local(10).nombre).toBe('Arriendo');
      expect(toast.error).toHaveBeenCalledWith('Error al actualizar concepto');
    });
  });

  // ==========================================
  describe('bulk actions', () => {
    beforeEach(() => {
      component.toggleSelectItem(10);
      component.toggleSelectItem(11);
    });

    it('should not call the service with an empty selection', () => {
      component.clearSelection();
      component.bulkSetEstado('completado');
      component.confirmBulkDelete();
      component.bulkSetCategoria(1);
      component.bulkSetBanco(1);
      expect(finanzas['batchUpdateEstado']).not.toHaveBeenCalled();
      expect(finanzas['batchDelete']).not.toHaveBeenCalled();
      expect(finanzas['batchUpdateCategoria']).not.toHaveBeenCalled();
      expect(finanzas['batchUpdateBanco']).not.toHaveBeenCalled();
    });

    it('bulkSetEstado should update, clear selection and reload', () => {
      component.bulkSetEstado('completado');
      expect(finanzas['batchUpdateEstado']).toHaveBeenCalledWith([10, 11], 'completado');
      expect(toast.success).toHaveBeenCalledWith('2 movimientos marcados como completado');
      expect(component.isBulkProcessing()).toBe(false);
      expect(component.selectedCount()).toBe(0);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('bulkSetEstado should keep selection but still reload on error', () => {
      finanzas['batchUpdateEstado'].mockReturnValue(throwError(() => new Error('x')));
      component.bulkSetEstado('completado');
      expect(toast.error).toHaveBeenCalledWith('Error al actualizar movimientos en lote');
      expect(component.isBulkProcessing()).toBe(false);
      expect(component.selectedCount()).toBe(2);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('request/cancel bulk delete should toggle the modal', () => {
      component.requestBulkDelete();
      expect(component.showBulkDeleteModal()).toBe(true);
      component.cancelBulkDelete();
      expect(component.showBulkDeleteModal()).toBe(false);
    });

    it('confirmBulkDelete should delete, close modal and clear selection', () => {
      component.requestBulkDelete();
      component.confirmBulkDelete();
      expect(finanzas['batchDelete']).toHaveBeenCalledWith([10, 11]);
      expect(toast.success).toHaveBeenCalledWith('2 movimientos eliminados');
      expect(component.showBulkDeleteModal()).toBe(false);
      expect(component.selectedCount()).toBe(0);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('confirmBulkDelete should close modal and keep selection on error', () => {
      finanzas['batchDelete'].mockReturnValue(throwError(() => new Error('x')));
      component.requestBulkDelete();
      component.confirmBulkDelete();
      expect(toast.error).toHaveBeenCalledWith('Error al eliminar movimientos en lote');
      expect(component.showBulkDeleteModal()).toBe(false);
      expect(component.selectedCount()).toBe(2);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('bulkSetCategoria should use the category name in the toast', () => {
      component.bulkSetCategoria(100);
      expect(finanzas['batchUpdateCategoria']).toHaveBeenCalledWith([10, 11], 100);
      expect(toast.success).toHaveBeenCalledWith('2 movimientos asignados a "Casa"');
      expect(component.selectedCount()).toBe(0);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('bulkSetCategoria(null) should fall back to "Sin categoría"', () => {
      component.bulkSetCategoria(null);
      expect(toast.success).toHaveBeenCalledWith('2 movimientos asignados a "Sin categoría"');
    });

    it('bulkSetCategoria should toast on error', () => {
      finanzas['batchUpdateCategoria'].mockReturnValue(throwError(() => new Error('x')));
      component.bulkSetCategoria(100);
      expect(toast.error).toHaveBeenCalledWith('Error al asignar categoría en lote');
      expect(component.isBulkProcessing()).toBe(false);
      expect(component.selectedCount()).toBe(2);
    });

    it('bulkSetBanco should use the banco name or fallback', () => {
      component.bulkSetBanco(1);
      expect(finanzas['batchUpdateBanco']).toHaveBeenCalledWith([10, 11], 1);
      expect(toast.success).toHaveBeenCalledWith('2 movimientos asignados a "BCI"');
      expect(component.selectedCount()).toBe(0);

      component.toggleSelectItem(12);
      component.bulkSetBanco(999);
      expect(toast.success).toHaveBeenLastCalledWith('1 movimientos asignados a "Sin cuenta"');
    });

    it('bulkSetBanco should toast on error', () => {
      finanzas['batchUpdateBanco'].mockReturnValue(throwError(() => new Error('x')));
      component.bulkSetBanco(1);
      expect(toast.error).toHaveBeenCalledWith('Error al asignar cuenta en lote');
      expect(component.isBulkProcessing()).toBe(false);
    });
  });

  // ==========================================
  describe('single delete', () => {
    it('request/cancel should manage the target', () => {
      component.requestDelete(items[2]);
      expect(component.itemToDelete()).toBe(items[2]);
      component.cancelDelete();
      expect(component.itemToDelete()).toBeNull();
    });

    it('confirmDelete should do nothing without target', () => {
      component.confirmDelete();
      expect(finanzas['deletePlantillaItem']).not.toHaveBeenCalled();
    });

    it('confirmDelete should delete, deselect and reload', () => {
      component.toggleSelectItem(10);
      component.toggleSelectItem(11);
      component.requestDelete(items[2]);
      component.confirmDelete();
      expect(finanzas['deletePlantillaItem']).toHaveBeenCalledWith(10);
      expect(toast.success).toHaveBeenCalledWith('"Arriendo" eliminado');
      expect(component.itemToDelete()).toBeNull();
      expect(component.isDeletingItem()).toBe(false);
      expect([...component.selectedIds()]).toEqual([11]);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('confirmDelete should toast on error', () => {
      finanzas['deletePlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
      component.requestDelete(items[2]);
      component.confirmDelete();
      expect(toast.error).toHaveBeenCalledWith('Error al eliminar movimiento');
      expect(component.isDeletingItem()).toBe(false);
      expect(component.itemToDelete()).toBe(items[2]);
    });
  });

  // ==========================================
  describe('modals', () => {
    it('openCreateModal should open the form modal with the given tipo', () => {
      component.openCreateModal('ingreso');
      const modal = child(MovimientoFormModal);
      expect(modal.showItemModal()).toBe(true);
      expect(modal.isEditingItem()).toBe(false);
      expect(modal.formTipo()).toBe('ingreso');
    });

    it('openEditModal should open the form modal for the item', () => {
      component.openEditModal(items[2]);
      const modal = child(MovimientoFormModal);
      expect(modal.isEditingItem()).toBe(true);
      expect(modal.editingItemId()).toBe(10);
    });

    it('a saved form should reload', () => {
      child(MovimientoFormModal).saved.emit();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('openCloneModal should open the clone modal from the selected period', () => {
      component.openCloneModal();
      const modal = child(ClonarPeriodoModal);
      expect(modal.showCloneModal()).toBe(true);
      expect(modal.cloneMesOrigen()).toBe(5);
      expect(modal.cloneAnioOrigen()).toBe(2026);
    });

    it('a cloned period should be forwarded as periodoChange', () => {
      child(ClonarPeriodoModal).cloned.emit({ mes: 6, anio: 2026 });
      expect(periodoSpy).toHaveBeenCalledWith({ mes: 6, anio: 2026 });
    });

    it('a quick-add creation should reload', () => {
      child(MovimientoQuickAdd).created.emit();
      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
