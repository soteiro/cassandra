import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideChevronDown, LucideLayers, LucidePlus } from '@lucide/angular';
import { FinanzasService } from '../../data/finanzas.service';
import { ToastService } from '../../../../shared/services/toast.service';
import {
  Banco,
  EstadoFinanzas,
  FinanzasPlantillaItem,
  FinanzasResumenPeriodo,
  GrupoItemFinanzas,
  MovimientoEsperadoFinanzas,
  TipoMovimientoFinanzas,
} from '../../data/finanzas.model';
import { ConfirmModal } from '../../../../shared/ui/confirm-modal/confirm-modal';
import {
  agruparMovimientos,
  FiltroEstadoFinanzas,
  filtrarMovimientos,
  FinanzasGroup,
  FinanzasGroupMode,
  formatCLP,
} from '../../utils/presupuesto.util';
import { MovimientoQuickAdd } from '../movimiento-quick-add/movimiento-quick-add';
import { MovimientoRow } from '../movimiento-row/movimiento-row';
import { BulkActionsBar } from '../bulk-actions-bar/bulk-actions-bar';
import { MovimientoFormModal } from '../movimiento-form-modal/movimiento-form-modal';
import { ClonarPeriodoModal } from '../clonar-periodo-modal/clonar-periodo-modal';

/**
 * Planilla de movimientos del período: filtra, agrupa y selecciona, y persiste los cambios
 * que emiten las filas y la barra de acciones en lote (con actualización optimista).
 */
@Component({
  selector: 'app-presupuesto-tab',
  imports: [
    FormsModule,
    ConfirmModal,
    LucideChevronDown,
    LucideLayers,
    LucidePlus,
    MovimientoQuickAdd,
    MovimientoRow,
    BulkActionsBar,
    MovimientoFormModal,
    ClonarPeriodoModal,
  ],
  templateUrl: './presupuesto-tab.html',
  host: { '(document:click)': 'statusMenuOpenId.set(null)' },
})
export class PresupuestoTab {
  selectedAnio = input.required<number>();
  selectedMes = input.required<number>();
  items = input<FinanzasPlantillaItem[]>([]);
  resumen = input<FinanzasResumenPeriodo>({
    mes: 1,
    anio: 2026,
    total_ingresos: 0,
    total_egresos: 0,
    balance: 0,
  });
  bancos = input<Banco[]>([]);
  grupos = input<GrupoItemFinanzas[]>([]);
  movimientosEsperados = input<MovimientoEsperadoFinanzas[]>([]);
  isLoading = input<boolean>(false);
  searchQuery = input<string>('');
  meses = input<string[]>([
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
  ]);

  reload = output<void>();
  periodoChange = output<{ mes: number; anio: number }>();

  private readonly finanzasService = inject(FinanzasService);
  private readonly toastService = inject(ToastService);

  private readonly formModal = viewChild.required(MovimientoFormModal);
  private readonly cloneModal = viewChild.required(ClonarPeriodoModal);

  protected readonly formatCLP = formatCLP;

  // Subpestaña de movimientos: 'egresos' (principal) o 'ingresos'
  movimientosSubTab = signal<'egresos' | 'ingresos'>('egresos');

  // Agrupación dinámica estilo Excel
  groupMode = signal<FinanzasGroupMode>('categoria');
  collapsedGroups = signal<Set<string>>(new Set());

  statusFilter = signal<FiltroEstadoFinanzas>('all');

  // Selección múltiple para acciones masivas
  selectedIds = signal<Set<number>>(new Set());
  isBulkProcessing = signal<boolean>(false);
  showBulkDeleteModal = signal<boolean>(false);

  // Menú flotante de estado: solo una fila lo tiene abierto a la vez
  statusMenuOpenId = signal<number | null>(null);

  // Modal de Confirmación de Borrado individual
  itemToDelete = signal<FinanzasPlantillaItem | null>(null);
  isDeletingItem = signal<boolean>(false);

  // Copia local de `items` para actualizaciones optimistas; se resincroniza
  // con el input cada vez que el padre recarga.
  readonly localItems = linkedSignal(() => this.items());

  private patchItem(id: number, patch: Partial<FinanzasPlantillaItem>): void {
    this.localItems.update((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  ingresos = computed(() =>
    filtrarMovimientos(this.localItems(), 'ingreso', this.searchQuery(), this.statusFilter()),
  );

  egresos = computed(() =>
    filtrarMovimientos(this.localItems(), 'egreso', this.searchQuery(), this.statusFilter()),
  );

  selectedCount = computed(() => this.selectedIds().size);

  selectedTotalMonto = computed(() => {
    const sel = this.selectedIds();
    return this.localItems()
      .filter((i) => sel.has(i.id))
      .reduce((sum, i) => sum + (i.monto || 0), 0);
  });

  groupedEgresos = computed<FinanzasGroup[]>(() =>
    agruparMovimientos(this.egresos(), this.groupMode(), 'egreso'),
  );

  groupedIngresos = computed<FinanzasGroup[]>(() =>
    agruparMovimientos(this.ingresos(), this.groupMode(), 'ingreso'),
  );

  currentGroupedList = computed<FinanzasGroup[]>(() =>
    this.movimientosSubTab() === 'egresos' ? this.groupedEgresos() : this.groupedIngresos(),
  );

  private visibleItems(): FinanzasPlantillaItem[] {
    return this.movimientosSubTab() === 'egresos' ? this.egresos() : this.ingresos();
  }

  // ==========================================
  // AGRUPACIÓN
  // ==========================================
  toggleGroupCollapse(key: string): void {
    const current = new Set(this.collapsedGroups());
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    this.collapsedGroups.set(current);
  }

  isGroupCollapsed(key: string): boolean {
    return this.collapsedGroups().has(key);
  }

  expandAllGroups(): void {
    this.collapsedGroups.set(new Set());
  }

  collapseAllGroups(): void {
    const allKeys = this.currentGroupedList().map((g) => g.key);
    this.collapsedGroups.set(new Set(allKeys));
  }

  // ==========================================
  // SELECCIÓN MÚLTIPLE
  // ==========================================
  toggleSelectItem(id: number): void {
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds.set(current);
  }

  isItemSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelectGroup(group: FinanzasGroup, event?: Event): void {
    event?.stopPropagation();
    const current = new Set(this.selectedIds());
    const allSelected = group.items.every((i) => current.has(i.id));

    if (allSelected) {
      group.items.forEach((i) => current.delete(i.id));
    } else {
      group.items.forEach((i) => current.add(i.id));
    }
    this.selectedIds.set(current);
  }

  isGroupAllSelected(group: FinanzasGroup): boolean {
    return group.items.length > 0 && group.items.every((i) => this.selectedIds().has(i.id));
  }

  isGroupSomeSelected(group: FinanzasGroup): boolean {
    return group.items.some((i) => this.selectedIds().has(i.id)) && !this.isGroupAllSelected(group);
  }

  toggleSelectAllVisible(event?: Event): void {
    event?.stopPropagation();
    const visibleItems = this.visibleItems();
    const current = new Set(this.selectedIds());
    const allSelected = visibleItems.length > 0 && visibleItems.every((i) => current.has(i.id));

    if (allSelected) {
      visibleItems.forEach((i) => current.delete(i.id));
    } else {
      visibleItems.forEach((i) => current.add(i.id));
    }
    this.selectedIds.set(current);
  }

  isAllVisibleSelected(): boolean {
    const visibleItems = this.visibleItems();
    return visibleItems.length > 0 && visibleItems.every((i) => this.selectedIds().has(i.id));
  }

  isSomeVisibleSelected(): boolean {
    return (
      this.visibleItems().some((i) => this.selectedIds().has(i.id)) && !this.isAllVisibleSelected()
    );
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  // ==========================================
  // CAMBIOS DESDE UNA FILA (OPTIMISTAS)
  // ==========================================
  toggleStatusMenu(id: number): void {
    this.statusMenuOpenId.set(this.statusMenuOpenId() === id ? null : id);
  }

  setItemEstado(item: FinanzasPlantillaItem, estado: EstadoFinanzas): void {
    this.statusMenuOpenId.set(null);
    if (item.estado === estado) return;

    const prev = item.estado;
    this.patchItem(item.id, { estado });

    this.finanzasService.updatePlantillaItem(item.id, { estado }).subscribe({
      next: () => {
        this.toastService.success(`"${item.nombre}" marcado como ${estado}`);
        this.reload.emit();
      },
      error: (err) => {
        this.patchItem(item.id, { estado: prev });
        this.toastService.error('Error al actualizar estado');
        console.error(err);
      },
    });
  }

  updateMonto(item: FinanzasPlantillaItem, monto: number): void {
    const prevMonto = item.monto;
    this.patchItem(item.id, { monto });

    this.finanzasService.updatePlantillaItem(item.id, { monto }).subscribe({
      next: () => {
        this.toastService.success(`Monto actualizado a ${formatCLP(monto)}`);
        this.reload.emit();
      },
      error: (err) => {
        this.patchItem(item.id, { monto: prevMonto });
        this.toastService.error('Error al actualizar monto');
        console.error(err);
        this.reload.emit();
      },
    });
  }

  updateNombre(item: FinanzasPlantillaItem, nombre: string): void {
    const prevName = item.nombre;
    this.patchItem(item.id, { nombre });

    this.finanzasService.updatePlantillaItem(item.id, { nombre }).subscribe({
      next: () => {
        this.toastService.success('Concepto actualizado');
      },
      error: (err) => {
        this.patchItem(item.id, { nombre: prevName });
        this.toastService.error('Error al actualizar concepto');
        console.error(err);
      },
    });
  }

  // ==========================================
  // ACCIONES EN LOTE (BULK ACTIONS)
  // ==========================================
  bulkSetEstado(estado: EstadoFinanzas): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.isBulkProcessing.set(true);

    this.finanzasService.batchUpdateEstado(ids, estado).subscribe({
      next: () => {
        this.toastService.success(`${ids.length} movimientos marcados como ${estado}`);
        this.isBulkProcessing.set(false);
        this.clearSelection();
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al actualizar movimientos en lote');
        this.isBulkProcessing.set(false);
        this.reload.emit();
        console.error(err);
      },
    });
  }

  requestBulkDelete(): void {
    this.showBulkDeleteModal.set(true);
  }

  cancelBulkDelete(): void {
    this.showBulkDeleteModal.set(false);
  }

  confirmBulkDelete(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.isBulkProcessing.set(true);
    this.finanzasService.batchDelete(ids).subscribe({
      next: () => {
        this.toastService.success(`${ids.length} movimientos eliminados`);
        this.isBulkProcessing.set(false);
        this.showBulkDeleteModal.set(false);
        this.clearSelection();
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al eliminar movimientos en lote');
        this.isBulkProcessing.set(false);
        this.reload.emit();
        this.showBulkDeleteModal.set(false);
        console.error(err);
      },
    });
  }

  bulkSetCategoria(grupoId: number | null): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.isBulkProcessing.set(true);
    this.finanzasService.batchUpdateCategoria(ids, grupoId).subscribe({
      next: () => {
        const catNombre = this.grupos().find((g) => g.id === grupoId)?.nombre || 'Sin categoría';
        this.toastService.success(`${ids.length} movimientos asignados a "${catNombre}"`);
        this.isBulkProcessing.set(false);
        this.clearSelection();
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al asignar categoría en lote');
        this.isBulkProcessing.set(false);
        this.reload.emit();
        console.error(err);
      },
    });
  }

  bulkSetBanco(bancoId: number | null): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.isBulkProcessing.set(true);
    this.finanzasService.batchUpdateBanco(ids, bancoId).subscribe({
      next: () => {
        const bancoNombre = this.bancos().find((b) => b.id === bancoId)?.nombre || 'Sin cuenta';
        this.toastService.success(`${ids.length} movimientos asignados a "${bancoNombre}"`);
        this.isBulkProcessing.set(false);
        this.clearSelection();
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al asignar cuenta en lote');
        this.isBulkProcessing.set(false);
        this.reload.emit();
        console.error(err);
      },
    });
  }

  // ==========================================
  // MODALES (también los abre la página de finanzas)
  // ==========================================
  openCreateModal(tipo: TipoMovimientoFinanzas = 'egreso'): void {
    this.formModal().openCreate(tipo);
  }

  openEditModal(item: FinanzasPlantillaItem): void {
    this.formModal().openEdit(item);
  }

  openCloneModal(): void {
    this.cloneModal().open();
  }

  // Borrado de ítem individual
  requestDelete(item: FinanzasPlantillaItem): void {
    this.itemToDelete.set(item);
  }

  cancelDelete(): void {
    this.itemToDelete.set(null);
  }

  confirmDelete(): void {
    const target = this.itemToDelete();
    if (!target) return;

    this.isDeletingItem.set(true);
    this.finanzasService.deletePlantillaItem(target.id).subscribe({
      next: () => {
        this.toastService.success(`"${target.nombre}" eliminado`);
        this.isDeletingItem.set(false);
        this.itemToDelete.set(null);
        const current = new Set(this.selectedIds());
        current.delete(target.id);
        this.selectedIds.set(current);
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al eliminar movimiento');
        this.isDeletingItem.set(false);
        console.error(err);
      },
    });
  }
}
