import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PresupuestoTab, FinanzasGroup } from './presupuesto-tab';
import { FinanzasService } from '../../../../services/finanzas.service';
import { ToastService } from '../../../../services/toast.service';
import { FinanzasPlantillaItem } from '../../../../models/finanzas.model';

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
    item({ id: 1, tipo: 'ingreso', nombre: 'Sueldo', monto: 2000, estado: 'completado', banco_id: 1, banco_nombre: 'BCI' }),
    item({ id: 2, tipo: 'ingreso', nombre: 'Freelance', monto: 500, estado: 'pendiente' }),
    item({ id: 10, nombre: 'Arriendo', monto: 600, estado: 'completado', grupo_item_id: 100, grupo_item_nombre: 'Casa', banco_id: 1, banco_nombre: 'BCI', movimiento_esperado_id: 7, movimiento_esperado_nombre: 'PAC' }),
    item({ id: 11, nombre: 'Luz', monto: 100, estado: 'en proceso', grupo_item_id: 100, grupo_item_nombre: 'Casa' }),
    item({ id: 12, nombre: 'Supermercado', monto: 300, estado: 'pendiente', grupo_item_id: 200, grupo_item_nombre: 'Comida', banco_id: 2, banco_nombre: 'Santander' }),
    item({ id: 13, nombre: 'Café', monto: 50, estado: 'pendiente' }),
  ];
}

describe('PresupuestoTab', () => {
  let component: PresupuestoTab;
  let fixture: ComponentFixture<PresupuestoTab>;
  let finanzas: Record<string, ReturnType<typeof vi.fn>>;
  let toast: ToastService;
  let reloadSpy: import('vitest').Mock<() => void>;
  let periodoSpy: import('vitest').Mock<(v: { mes: number; anio: number }) => void>;
  let items: FinanzasPlantillaItem[];

  /** Versión actual del ítem en la copia local del componente. */
  const local = (id: number) => component.localItems().find((i) => i.id === id)!;

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
  describe('filters', () => {
    it('should split items by tipo', () => {
      expect(component.ingresos().map((i) => i.id)).toEqual([1, 2]);
      expect(component.egresos().map((i) => i.id)).toEqual([10, 11, 12, 13]);
    });

    it('should filter egresos by search across nombre, banco, categoría and mecanismo', async () => {
      fixture.componentRef.setInput('searchQuery', '  CASA ');
      expect(component.egresos().map((i) => i.id)).toEqual([10, 11]);
      fixture.componentRef.setInput('searchQuery', 'santander');
      expect(component.egresos().map((i) => i.id)).toEqual([12]);
      fixture.componentRef.setInput('searchQuery', 'pac');
      expect(component.egresos().map((i) => i.id)).toEqual([10]);
      fixture.componentRef.setInput('searchQuery', 'café');
      expect(component.egresos().map((i) => i.id)).toEqual([13]);
    });

    it('should filter ingresos by nombre and banco only', () => {
      fixture.componentRef.setInput('searchQuery', 'bci');
      expect(component.ingresos().map((i) => i.id)).toEqual([1]);
      fixture.componentRef.setInput('searchQuery', 'free');
      expect(component.ingresos().map((i) => i.id)).toEqual([2]);
    });

    it('should filter by status', () => {
      component.statusFilter.set('pendientes');
      expect(component.egresos().map((i) => i.id)).toEqual([12, 13]);
      expect(component.ingresos().map((i) => i.id)).toEqual([2]);
      component.statusFilter.set('en_proceso');
      expect(component.egresos().map((i) => i.id)).toEqual([11]);
      component.statusFilter.set('completados');
      expect(component.egresos().map((i) => i.id)).toEqual([10]);
      expect(component.ingresos().map((i) => i.id)).toEqual([1]);
    });

    it('should combine search and status', () => {
      fixture.componentRef.setInput('searchQuery', 'casa');
      component.statusFilter.set('completados');
      expect(component.egresos().map((i) => i.id)).toEqual([10]);
    });
  });

  // ==========================================
  describe('grouping and totals', () => {
    it('should group by categoría by default, sorted by total desc', () => {
      const groups = component.groupedEgresos();
      expect(groups.map((g) => g.key)).toEqual(['cat_100', 'cat_200', 'sin_categoria']);
      const casa = groups[0];
      expect(casa.title).toBe('Casa');
      expect(casa.total).toBe(700);
      expect(casa.totalCompletado).toBe(600);
      expect(casa.totalEnProceso).toBe(100);
      expect(casa.totalPendiente).toBe(0);
      expect(casa.porcentajeCompletado).toBe(86);
      expect(groups[2].title).toBe('Sin categoría');
      expect(groups[2].total).toBe(50);
      expect(groups[2].porcentajeCompletado).toBe(0);
    });

    it('should group by banco', () => {
      component.groupMode.set('banco');
      const groups = component.groupedEgresos();
      expect(groups.map((g) => [g.key, g.title, g.total])).toEqual([
        ['banco_1', 'BCI', 600],
        ['banco_2', 'Santander', 300],
        ['sin_banco', 'Sin cuenta / banco', 150],
      ]);
    });

    it('should group by mecanismo', () => {
      component.groupMode.set('mecanismo');
      const groups = component.groupedEgresos();
      expect(groups.map((g) => [g.key, g.title, g.total])).toEqual([
        ['mec_7', 'PAC', 600],
        ['sin_mecanismo', 'Sin mecanismo', 450],
      ]);
    });

    it('should group by estado', () => {
      component.groupMode.set('estado');
      const groups = component.groupedEgresos();
      expect(groups.map((g) => [g.key, g.title, g.total])).toEqual([
        ['estado_completado', 'Completados', 600],
        ['estado_pendiente', 'Pendientes', 350],
        ['estado_en proceso', 'En Proceso', 100],
      ]);
    });

    it('should return a single group in "ninguno" mode with aggregate totals', () => {
      component.groupMode.set('ninguno');
      const [g] = component.groupedEgresos();
      expect(g.key).toBe('todos');
      expect(g.title).toBe('Todos los gastos');
      expect(g.items.length).toBe(4);
      expect(g.total).toBe(1050);
      expect(g.totalCompletado).toBe(600);
      expect(g.totalEnProceso).toBe(100);
      expect(g.totalPendiente).toBe(350);
      expect(g.porcentajeCompletado).toBe(57);

      const [gi] = component.groupedIngresos();
      expect(gi.title).toBe('Todos los ingresos');
      expect(gi.total).toBe(2500);
      expect(gi.porcentajeCompletado).toBe(80);
    });

    it('should report 0% when the group total is 0', () => {
      fixture.componentRef.setInput('items', []);
      component.groupMode.set('ninguno');
      const [g] = component.groupedEgresos();
      expect(g.total).toBe(0);
      expect(g.porcentajeCompletado).toBe(0);
      component.groupMode.set('categoria');
      expect(component.groupedEgresos()).toEqual([]);
    });

    it('should treat missing montos as 0', () => {
      fixture.componentRef.setInput('items', [
        item({ id: 1, monto: null as unknown as number }),
        item({ id: 2, monto: 10 }),
      ]);
      component.groupMode.set('ninguno');
      expect(component.groupedEgresos()[0].total).toBe(10);
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
        ['cat_100', 'cat_200', 'sin_categoria'].sort()
      );
      component.expandAllGroups();
      expect(component.collapsedGroups().size).toBe(0);
    });
  });

  // ==========================================
  describe('multi selection', () => {
    it('should toggle a single item and stop propagation', () => {
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.toggleSelectItem(10, event);
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.isItemSelected(10)).toBe(true);
      expect(component.selectedCount()).toBe(1);
      component.toggleSelectItem(10);
      expect(component.isItemSelected(10)).toBe(false);
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
        key: 'e', title: 'e', items: [], total: 0, totalCompletado: 0,
        totalEnProceso: 0, totalPendiente: 0, porcentajeCompletado: 0,
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

    it('clearSelection should reset selection and bulk menus', () => {
      component.toggleSelectItem(10);
      component.showBulkCategoryMenu.set(true);
      component.showBulkBancoMenu.set(true);
      component.clearSelection();
      expect(component.selectedCount()).toBe(0);
      expect(component.showBulkCategoryMenu()).toBe(false);
      expect(component.showBulkBancoMenu()).toBe(false);
    });

    it('document click should close floating menus', () => {
      component.statusMenuOpenId.set(10);
      component.showBulkCategoryMenu.set(true);
      document.dispatchEvent(new MouseEvent('click'));
      expect(component.statusMenuOpenId()).toBeNull();
      expect(component.showBulkCategoryMenu()).toBe(false);
    });
  });

  // ==========================================
  describe('estado changes', () => {
    it('cycleItemEstado should go pendiente -> en proceso -> completado -> pendiente', () => {
      // items[4] (id 12) está pendiente; cada ciclo usa la versión actualizada de la lista local.
      component.cycleItemEstado(local(12));
      expect(finanzas['updatePlantillaItem']).toHaveBeenLastCalledWith(12, { estado: 'en proceso' });
      component.cycleItemEstado(local(12));
      expect(finanzas['updatePlantillaItem']).toHaveBeenLastCalledWith(12, { estado: 'completado' });
      component.cycleItemEstado(local(12));
      expect(finanzas['updatePlantillaItem']).toHaveBeenLastCalledWith(12, { estado: 'pendiente' });
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
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.toggleStatusMenu(10, event);
      expect(component.statusMenuOpenId()).toBe(10);
      component.toggleStatusMenu(10, event);
      expect(component.statusMenuOpenId()).toBeNull();
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
      component.showBulkCategoryMenu.set(true);
      component.bulkSetCategoria(100);
      expect(finanzas['batchUpdateCategoria']).toHaveBeenCalledWith([10, 11], 100);
      expect(toast.success).toHaveBeenCalledWith('2 movimientos asignados a "Casa"');
      expect(component.showBulkCategoryMenu()).toBe(false);
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
  describe('inline monto', () => {
    it('should start editing with the current monto', () => {
      component.startInlineMonto(items[2]);
      expect(component.editingMontoId()).toBe(10);
      expect(component.editingMontoValue()).toBe(600);
    });

    it('should ignore saves for another item', () => {
      component.startInlineMonto(items[2]);
      component.saveInlineMonto(items[3]);
      expect(finanzas['updatePlantillaItem']).not.toHaveBeenCalled();
      expect(component.editingMontoId()).toBe(10);
    });

    it('should not call the service when value is unchanged or null', () => {
      component.startInlineMonto(items[2]);
      component.saveInlineMonto(items[2]);
      expect(component.editingMontoId()).toBeNull();

      component.startInlineMonto(items[2]);
      component.editingMontoValue.set(null);
      component.saveInlineMonto(items[2]);
      expect(finanzas['updatePlantillaItem']).not.toHaveBeenCalled();
    });

    it('should update the monto optimistically and reload', () => {
      component.startInlineMonto(items[2]);
      component.editingMontoValue.set(750);
      component.saveInlineMonto(items[2]);
      expect(finanzas['updatePlantillaItem']).toHaveBeenCalledWith(10, { monto: 750 });
      expect(local(10).monto).toBe(750);
      expect(items[2].monto).toBe(600);
      expect(toast.success).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should revert the monto on error and still reload', () => {
      finanzas['updatePlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
      component.startInlineMonto(items[2]);
      component.editingMontoValue.set(750);
      component.saveInlineMonto(items[2]);
      expect(local(10).monto).toBe(600);
      expect(toast.error).toHaveBeenCalledWith('Error al actualizar monto');
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('cancelInlineMonto should reset state', () => {
      component.startInlineMonto(items[2]);
      component.cancelInlineMonto();
      expect(component.editingMontoId()).toBeNull();
      expect(component.editingMontoValue()).toBeNull();
    });
  });

  // ==========================================
  describe('inline nombre', () => {
    it('should update a trimmed new name', () => {
      component.startInlineNombre(items[2]);
      expect(component.editingNombreValue()).toBe('Arriendo');
      component.editingNombreValue.set('  Dividendo ');
      component.saveInlineNombre(items[2]);
      expect(finanzas['updatePlantillaItem']).toHaveBeenCalledWith(10, { nombre: 'Dividendo' });
      expect(local(10).nombre).toBe('Dividendo');
      expect(items[2].nombre).toBe('Arriendo');
      expect(toast.success).toHaveBeenCalledWith('Concepto actualizado');
    });

    it('should skip empty or unchanged names', () => {
      component.startInlineNombre(items[2]);
      component.editingNombreValue.set('   ');
      component.saveInlineNombre(items[2]);
      component.startInlineNombre(items[2]);
      component.saveInlineNombre(items[2]);
      expect(finanzas['updatePlantillaItem']).not.toHaveBeenCalled();
      expect(component.editingNombreId()).toBeNull();
    });

    it('should revert on error', () => {
      finanzas['updatePlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
      component.startInlineNombre(items[2]);
      component.editingNombreValue.set('Otro');
      component.saveInlineNombre(items[2]);
      expect(local(10).nombre).toBe('Arriendo');
      expect(toast.error).toHaveBeenCalledWith('Error al actualizar concepto');
    });

    it('cancelInlineNombre should reset state', () => {
      component.startInlineNombre(items[2]);
      component.cancelInlineNombre();
      expect(component.editingNombreId()).toBeNull();
      expect(component.editingNombreValue()).toBe('');
    });
  });

  // ==========================================
  describe('item modal', () => {
    it('openCreateModal should reset the form with the given tipo', () => {
      component.formNombre.set('old');
      component.openCreateModal('ingreso');
      expect(component.showItemModal()).toBe(true);
      expect(component.isEditingItem()).toBe(false);
      expect(component.formTipo()).toBe('ingreso');
      expect(component.formNombre()).toBe('');
      expect(component.formEstado()).toBe('pendiente');
    });

    it('openEditModal should populate the form from the item', () => {
      component.openEditModal(items[2]);
      expect(component.isEditingItem()).toBe(true);
      expect(component.editingItemId()).toBe(10);
      expect(component.formNombre()).toBe('Arriendo');
      expect(component.formMonto()).toBe(600);
      expect(component.formBancoId()).toBe(1);
      expect(component.formGrupoItemId()).toBe(100);
      expect(component.formMovimientoEsperadoId()).toBe(7);
      expect(component.formEstado()).toBe('completado');
    });

    it('openEditModal should map undefined relations to null', () => {
      component.openEditModal(items[5]);
      expect(component.formBancoId()).toBeNull();
      expect(component.formGrupoItemId()).toBeNull();
      expect(component.formMovimientoEsperadoId()).toBeNull();
    });

    it('closeItemModal should reset editing state', () => {
      component.openEditModal(items[2]);
      component.closeItemModal();
      expect(component.showItemModal()).toBe(false);
      expect(component.isEditingItem()).toBe(false);
      expect(component.editingItemId()).toBeNull();
    });

    it('saveItem should require a name', () => {
      component.openCreateModal();
      component.saveItem();
      expect(toast.error).toHaveBeenCalledWith('El nombre del movimiento es obligatorio');
      expect(finanzas['createPlantillaItem']).not.toHaveBeenCalled();
    });

    it('saveItem should create an egreso including categoría and mecanismo', () => {
      component.openCreateModal('egreso');
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
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('saveItem should drop categoría/mecanismo for ingresos and default monto to 0', () => {
      component.openCreateModal('ingreso');
      component.formNombre.set('Bono');
      component.formGrupoItemId.set(100);
      component.formMovimientoEsperadoId.set(7);
      component.saveItem();
      expect(finanzas['createPlantillaItem']).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'ingreso', monto: 0, grupo_item_id: null, movimiento_esperado_id: null })
      );
    });

    it('saveItem should toast on create error and keep modal open', () => {
      finanzas['createPlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
      component.openCreateModal();
      component.formNombre.set('Gas');
      component.saveItem();
      expect(toast.error).toHaveBeenCalledWith('Error al crear movimiento');
      expect(component.showItemModal()).toBe(true);
      expect(component.isSubmittingItem()).toBe(false);
    });

    it('saveItem should update when editing', () => {
      component.openEditModal(items[2]);
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
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('saveItem should toast on update error', () => {
      finanzas['updatePlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
      component.openEditModal(items[2]);
      component.saveItem();
      expect(toast.error).toHaveBeenCalledWith('Error al actualizar movimiento');
      expect(component.isSubmittingItem()).toBe(false);
    });

    // Documenta el comportamiento actual: si se edita sin id, isSubmittingItem queda en true.
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

  // ==========================================
  describe('quick create', () => {
    it('should ignore blank names', () => {
      component.quickNombre.set('  ');
      component.createQuick();
      expect(finanzas['createPlantillaItem']).not.toHaveBeenCalled();
    });

    it('should create a pending egreso and reset fields', () => {
      component.quickNombre.set(' Pan ');
      component.quickMonto.set(2);
      component.quickBancoId.set(1);
      component.quickGrupoId.set(200);
      component.createQuick();
      expect(finanzas['createPlantillaItem']).toHaveBeenCalledWith({
        tipo: 'egreso',
        nombre: 'Pan',
        monto: 2,
        mes: 5,
        anio: 2026,
        estado: 'pendiente',
        banco_id: 1,
        grupo_item_id: 200,
      });
      expect(component.quickNombre()).toBe('');
      expect(component.quickMonto()).toBeNull();
      expect(component.isSubmittingQuick()).toBe(false);
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should drop grupo for ingresos', () => {
      component.quickTipo.set('ingreso');
      component.quickNombre.set('Venta');
      component.quickGrupoId.set(200);
      component.createQuick();
      expect(finanzas['createPlantillaItem']).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'ingreso', grupo_item_id: null, monto: 0 })
      );
    });

    it('should toast on error and keep the name', () => {
      finanzas['createPlantillaItem'].mockReturnValue(throwError(() => new Error('x')));
      component.quickNombre.set('Pan');
      component.createQuick();
      expect(toast.error).toHaveBeenCalledWith('Error al crear movimiento');
      expect(component.quickNombre()).toBe('Pan');
      expect(component.isSubmittingQuick()).toBe(false);
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
  describe('clone periodo', () => {
    it('openCloneModal should default destination to next month', () => {
      component.openCloneModal();
      expect(component.cloneMesOrigen()).toBe(5);
      expect(component.cloneAnioOrigen()).toBe(2026);
      expect(component.cloneMesDestino()).toBe(6);
      expect(component.cloneAnioDestino()).toBe(2026);
      expect(component.showCloneModal()).toBe(true);
    });

    it('openCloneModal should roll December to January of next year', () => {
      fixture.componentRef.setInput('selectedMes', 12);
      component.openCloneModal();
      expect(component.cloneMesDestino()).toBe(1);
      expect(component.cloneAnioDestino()).toBe(2027);
    });

    it('submitClone should clone, close the modal and emit periodoChange', () => {
      component.openCloneModal();
      component.submitClone();
      expect(finanzas['clonarPeriodo']).toHaveBeenCalledWith({
        anio_origen: 2026,
        mes_origen: 5,
        anio_destino: 2026,
        mes_destino: 6,
      });
      expect(toast.success).toHaveBeenCalledWith('¡Éxito! Se clonaron 4 movimientos a Junio 2026');
      expect(component.showCloneModal()).toBe(false);
      expect(component.isSubmittingClone()).toBe(false);
      expect(periodoSpy).toHaveBeenCalledWith({ mes: 6, anio: 2026 });
    });

    it('submitClone should coerce string values to numbers', () => {
      component.openCloneModal();
      component.cloneMesDestino.set('7' as unknown as number);
      component.submitClone();
      expect(finanzas['clonarPeriodo']).toHaveBeenCalledWith(
        expect.objectContaining({ mes_destino: 7 })
      );
    });

    it('submitClone should toast the backend error and keep modal open', () => {
      finanzas['clonarPeriodo'].mockReturnValue(throwError(() => ({ error: 'ya existe' })));
      component.openCloneModal();
      component.submitClone();
      expect(toast.error).toHaveBeenCalledWith('Error al clonar el período: ya existe');
      expect(component.showCloneModal()).toBe(true);
      expect(component.isSubmittingClone()).toBe(false);
      expect(periodoSpy).not.toHaveBeenCalled();
    });

    it('closeCloneModal should hide the modal', () => {
      component.openCloneModal();
      component.closeCloneModal();
      expect(component.showCloneModal()).toBe(false);
    });
  });

  // ==========================================
  describe('visual helpers', () => {
    it('getRowClass should prioritise selection, then estado', () => {
      expect(component.getRowClass(items[2])).toContain('emerald');
      expect(component.getRowClass(items[3])).toContain('amber');
      expect(component.getRowClass(items[4])).toContain('bg-surface');
      component.toggleSelectItem(10);
      expect(component.getRowClass(items[2])).toContain('bg-primary/10');
    });

    it('getMontoColorClass should depend on estado and tipo', () => {
      expect(component.getMontoColorClass(items[2])).toContain('emerald');
      expect(component.getMontoColorClass(items[3])).toContain('amber');
      expect(component.getMontoColorClass(items[4])).toContain('text-danger');
      expect(component.getMontoColorClass(items[1])).toContain('text-success');
    });

    it('getStatusBadgeClass should depend on estado', () => {
      expect(component.getStatusBadgeClass(items[2])).toContain('emerald');
      expect(component.getStatusBadgeClass(items[3])).toContain('amber');
      expect(component.getStatusBadgeClass(items[4])).toContain('text-muted');
    });

    it('formatCurrency should format CLP', () => {
      expect(component.formatCurrency(600)).toMatch(/600/);
    });
  });
});
