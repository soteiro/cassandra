import {
  Component,
  computed,
  linkedSignal,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanzasService } from '../../../../services/finanzas.service';
import { ToastService } from '../../../../services/toast.service';
import {
  Banco,
  ClonarPeriodoRequest,
  EstadoFinanzas,
  FinanzasPlantillaItem,
  FinanzasPlantillaRequest,
  FinanzasResumenPeriodo,
  GrupoItemFinanzas,
  MovimientoEsperadoFinanzas,
  TipoMovimientoFinanzas,
} from '../../../../models/finanzas.model';
import { ConfirmModal } from '../../../../components/confirm-modal/confirm-modal';
import { BackButtonService } from '../../../../services/back-button.service';
import {
  LucideWallet,
  LucidePlus,
  LucideCopy,
  LucideChevronDown,
  LucideTrash2,
  LucidePencil,
  LucideCheck,
  LucideLandmark,
  LucideTag,
  LucideSlidersHorizontal,
  LucideLayers,
  LucideClock,
  LucideX,
} from '@lucide/angular';
import { getErrorMessage } from '../../../../utils/http-error.util';

export type FinanzasGroupMode = 'categoria' | 'banco' | 'mecanismo' | 'estado' | 'ninguno';

export interface FinanzasGroup {
  key: string;
  title: string;
  items: FinanzasPlantillaItem[];
  total: number;
  totalCompletado: number;
  totalEnProceso: number;
  totalPendiente: number;
  porcentajeCompletado: number;
}

@Component({
  selector: 'app-presupuesto-tab',
  imports: [
    CommonModule,
    FormsModule,
    ConfirmModal,
    LucideWallet,
    LucidePlus,
    LucideCopy,
    LucideChevronDown,
    LucideTrash2,
    LucidePencil,
    LucideCheck,
    LucideLandmark,
    LucideTag,
    LucideSlidersHorizontal,
    LucideLayers,
    LucideClock,
    LucideX,
  ],
  templateUrl: './presupuesto-tab.html',
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
  private readonly backButtonService = inject(BackButtonService);

  // Subpestaña de movimientos: 'egresos' (principal) o 'ingresos'
  movimientosSubTab = signal<'egresos' | 'ingresos'>('egresos');

  // Agrupación dinámica estilo Excel
  groupMode = signal<FinanzasGroupMode>('categoria');
  collapsedGroups = signal<Set<string>>(new Set());

  // Filtros
  statusFilter = signal<'all' | 'pendientes' | 'en_proceso' | 'completados'>('all');

  // Selección múltiple para acciones masivas
  selectedIds = signal<Set<number>>(new Set());
  isBulkProcessing = signal<boolean>(false);
  showBulkDeleteModal = signal<boolean>(false);
  showBulkCategoryMenu = signal<boolean>(false);
  showBulkBancoMenu = signal<boolean>(false);

  // Edición inline rápida de Monto
  editingMontoId = signal<number | null>(null);
  editingMontoValue = signal<number | null>(null);

  // Edición inline rápida de Nombre/Concepto
  editingNombreId = signal<number | null>(null);
  editingNombreValue = signal<string>('');

  // Menú flotante de estado por fila
  statusMenuOpenId = signal<number | null>(null);

  // Modal de Crear / Editar Movimiento Completo
  showItemModal = signal<boolean>(false);
  isEditingItem = signal<boolean>(false);
  editingItemId = signal<number | null>(null);
  isSubmittingItem = signal<boolean>(false);

  private readonly _backBtnItem = this.backButtonService.registerEffect(
    () => this.showItemModal(),
    () => this.closeItemModal(),
    80
  );

  formTipo = signal<TipoMovimientoFinanzas>('egreso');
  formNombre = signal<string>('');
  formMonto = signal<number | null>(null);
  formBancoId = signal<number | null>(null);
  formGrupoItemId = signal<number | null>(null);
  formMovimientoEsperadoId = signal<number | null>(null);
  formEstado = signal<EstadoFinanzas>('pendiente');

  // Modal de Clonación
  showCloneModal = signal<boolean>(false);
  cloneAnioOrigen = signal<number>(new Date().getFullYear());
  cloneMesOrigen = signal<number>(new Date().getMonth() + 1);
  cloneAnioDestino = signal<number>(
    new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
  );
  cloneMesDestino = signal<number>(new Date().getMonth() === 11 ? 1 : new Date().getMonth() + 2);
  isSubmittingClone = signal<boolean>(false);

  private readonly _backBtnClone = this.backButtonService.registerEffect(
    () => this.showCloneModal(),
    () => this.closeCloneModal(),
    80
  );

  // Modal de Confirmación de Borrado individual
  itemToDelete = signal<FinanzasPlantillaItem | null>(null);
  isDeletingItem = signal<boolean>(false);

  // Creación rápida inline
  quickTipo = signal<TipoMovimientoFinanzas>('egreso');
  quickNombre = signal<string>('');
  quickMonto = signal<number | null>(null);
  quickBancoId = signal<number | null>(null);
  quickGrupoId = signal<number | null>(null);
  isSubmittingQuick = signal<boolean>(false);

  // Copia local de `items` para actualizaciones optimistas; se resincroniza
  // con el input cada vez que el padre recarga.
  readonly localItems = linkedSignal(() => this.items());

  private patchItem(id: number, patch: Partial<FinanzasPlantillaItem>): void {
    this.localItems.update((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  // Computados
  ingresos = computed(() => {
    let list = this.localItems().filter((i) => i.tipo === 'ingreso');
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      list = list.filter(
        (i) =>
          i.nombre.toLowerCase().includes(query) ||
          (i.banco_nombre && i.banco_nombre.toLowerCase().includes(query))
      );
    }
    const status = this.statusFilter();
    if (status === 'pendientes') {
      list = list.filter((i) => i.estado === 'pendiente');
    } else if (status === 'en_proceso') {
      list = list.filter((i) => i.estado === 'en proceso');
    } else if (status === 'completados') {
      list = list.filter((i) => i.estado === 'completado');
    }
    return list;
  });

  egresos = computed(() => {
    let list = this.localItems().filter((i) => i.tipo === 'egreso');
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      list = list.filter(
        (i) =>
          i.nombre.toLowerCase().includes(query) ||
          (i.banco_nombre && i.banco_nombre.toLowerCase().includes(query)) ||
          (i.grupo_item_nombre && i.grupo_item_nombre.toLowerCase().includes(query)) ||
          (i.movimiento_esperado_nombre && i.movimiento_esperado_nombre.toLowerCase().includes(query))
      );
    }
    const status = this.statusFilter();
    if (status === 'pendientes') {
      list = list.filter((i) => i.estado === 'pendiente');
    } else if (status === 'en_proceso') {
      list = list.filter((i) => i.estado === 'en proceso');
    } else if (status === 'completados') {
      list = list.filter((i) => i.estado === 'completado');
    }
    return list;
  });

  selectedCount = computed(() => this.selectedIds().size);

  selectedTotalMonto = computed(() => {
    const sel = this.selectedIds();
    return this.localItems()
      .filter((i) => sel.has(i.id))
      .reduce((sum, i) => sum + (i.monto || 0), 0);
  });

  groupedEgresos = computed<FinanzasGroup[]>(() => {
    return this.groupItems(this.egresos(), this.groupMode(), 'egreso');
  });

  groupedIngresos = computed<FinanzasGroup[]>(() => {
    return this.groupItems(this.ingresos(), this.groupMode(), 'ingreso');
  });

  currentGroupedList = computed<FinanzasGroup[]>(() => {
    return this.movimientosSubTab() === 'egresos'
      ? this.groupedEgresos()
      : this.groupedIngresos();
  });

  @HostListener('document:click')
  onDocumentClick(): void {
    this.statusMenuOpenId.set(null);
    this.showBulkCategoryMenu.set(false);
    this.showBulkBancoMenu.set(false);
  }

  // ==========================================
  // AGRUPACIÓN DINÁMICA
  // ==========================================
  private groupItems(
    items: FinanzasPlantillaItem[],
    mode: FinanzasGroupMode,
    tipo: TipoMovimientoFinanzas
  ): FinanzasGroup[] {
    if (mode === 'ninguno') {
      const total = items.reduce((acc, i) => acc + (i.monto || 0), 0);
      const totalCompletado = items
        .filter((i) => i.estado === 'completado')
        .reduce((acc, i) => acc + (i.monto || 0), 0);
      const totalEnProceso = items
        .filter((i) => i.estado === 'en proceso')
        .reduce((acc, i) => acc + (i.monto || 0), 0);
      const totalPendiente = items
        .filter((i) => i.estado === 'pendiente')
        .reduce((acc, i) => acc + (i.monto || 0), 0);

      return [
        {
          key: 'todos',
          title: tipo === 'egreso' ? 'Todos los gastos' : 'Todos los ingresos',
          items,
          total,
          totalCompletado,
          totalEnProceso,
          totalPendiente,
          porcentajeCompletado: total > 0 ? Math.round((totalCompletado / total) * 100) : 0,
        },
      ];
    }

    const map = new Map<string, { title: string; items: FinanzasPlantillaItem[] }>();

    for (const item of items) {
      let key = '';
      let title = '';

      switch (mode) {
        case 'categoria':
          key = item.grupo_item_id ? `cat_${item.grupo_item_id}` : 'sin_categoria';
          title = item.grupo_item_nombre || 'Sin categoría';
          break;
        case 'banco':
          key = item.banco_id ? `banco_${item.banco_id}` : 'sin_banco';
          title = item.banco_nombre || 'Sin cuenta / banco';
          break;
        case 'mecanismo':
          key = item.movimiento_esperado_id
            ? `mec_${item.movimiento_esperado_id}`
            : 'sin_mecanismo';
          title = item.movimiento_esperado_nombre || 'Sin mecanismo';
          break;
        case 'estado':
          key = `estado_${item.estado}`;
          title =
            item.estado === 'completado'
              ? 'Completados'
              : item.estado === 'en proceso'
              ? 'En Proceso'
              : 'Pendientes';
          break;
      }

      if (!map.has(key)) {
        map.set(key, { title, items: [] });
      }
      map.get(key)!.items.push(item);
    }

    const groups: FinanzasGroup[] = [];
    map.forEach((value, key) => {
      const total = value.items.reduce((acc, i) => acc + (i.monto || 0), 0);
      const totalCompletado = value.items
        .filter((i) => i.estado === 'completado')
        .reduce((acc, i) => acc + (i.monto || 0), 0);
      const totalEnProceso = value.items
        .filter((i) => i.estado === 'en proceso')
        .reduce((acc, i) => acc + (i.monto || 0), 0);
      const totalPendiente = value.items
        .filter((i) => i.estado === 'pendiente')
        .reduce((acc, i) => acc + (i.monto || 0), 0);

      groups.push({
        key,
        title: value.title,
        items: value.items,
        total,
        totalCompletado,
        totalEnProceso,
        totalPendiente,
        porcentajeCompletado: total > 0 ? Math.round((totalCompletado / total) * 100) : 0,
      });
    });

    return groups.sort((a, b) => b.total - a.total);
  }

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
  toggleSelectItem(id: number, event?: Event): void {
    event?.stopPropagation();
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
    return (
      group.items.some((i) => this.selectedIds().has(i.id)) && !this.isGroupAllSelected(group)
    );
  }

  toggleSelectAllVisible(event?: Event): void {
    event?.stopPropagation();
    const visibleItems = this.movimientosSubTab() === 'egresos' ? this.egresos() : this.ingresos();
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
    const visibleItems = this.movimientosSubTab() === 'egresos' ? this.egresos() : this.ingresos();
    return visibleItems.length > 0 && visibleItems.every((i) => this.selectedIds().has(i.id));
  }

  isSomeVisibleSelected(): boolean {
    const visibleItems = this.movimientosSubTab() === 'egresos' ? this.egresos() : this.ingresos();
    return visibleItems.some((i) => this.selectedIds().has(i.id)) && !this.isAllVisibleSelected();
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.showBulkCategoryMenu.set(false);
    this.showBulkBancoMenu.set(false);
  }

  // ==========================================
  // CAMBIOS DE ESTADO RÁPIDOS
  // ==========================================
  cycleItemEstado(item: FinanzasPlantillaItem, event?: Event): void {
    event?.stopPropagation();
    let nextEstado: EstadoFinanzas = 'pendiente';
    if (item.estado === 'pendiente') {
      nextEstado = 'en proceso';
    } else if (item.estado === 'en proceso') {
      nextEstado = 'completado';
    } else {
      nextEstado = 'pendiente';
    }
    this.setItemEstado(item, nextEstado);
  }

  setItemEstado(item: FinanzasPlantillaItem, estado: EstadoFinanzas, event?: Event): void {
    event?.stopPropagation();
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

  toggleStatusMenu(id: number, event: Event): void {
    event.stopPropagation();
    this.statusMenuOpenId.set(this.statusMenuOpenId() === id ? null : id);
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
        this.showBulkCategoryMenu.set(false);
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
        this.showBulkBancoMenu.set(false);
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
  // EDICIÓN INLINE RÁPIDA (MONTO Y NOMBRE)
  // ==========================================
  startInlineMonto(item: FinanzasPlantillaItem, event?: Event): void {
    event?.stopPropagation();
    this.editingMontoId.set(item.id);
    this.editingMontoValue.set(item.monto);
    setTimeout(() => {
      const el = document.getElementById(`inline-monto-${item.id}`) as HTMLInputElement;
      if (el) {
        el.focus();
        el.select();
      }
    }, 40);
  }

  saveInlineMonto(item: FinanzasPlantillaItem): void {
    if (this.editingMontoId() !== item.id) return;
    const rawVal = this.editingMontoValue();
    this.editingMontoId.set(null);

    if (rawVal === null || rawVal === undefined) return;
    const newVal = Number(rawVal);
    if (isNaN(newVal) || newVal === item.monto) return;

    const prevMonto = item.monto;
    this.patchItem(item.id, { monto: newVal });

    this.finanzasService.updatePlantillaItem(item.id, { monto: newVal }).subscribe({
      next: () => {
        this.toastService.success(`Monto actualizado a ${this.formatCurrency(newVal)}`);
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

  cancelInlineMonto(): void {
    this.editingMontoId.set(null);
    this.editingMontoValue.set(null);
  }

  startInlineNombre(item: FinanzasPlantillaItem, event?: Event): void {
    event?.stopPropagation();
    this.editingNombreId.set(item.id);
    this.editingNombreValue.set(item.nombre);
    setTimeout(() => {
      const el = document.getElementById(`inline-nombre-${item.id}`) as HTMLInputElement;
      if (el) {
        el.focus();
        el.select();
      }
    }, 40);
  }

  saveInlineNombre(item: FinanzasPlantillaItem): void {
    if (this.editingNombreId() !== item.id) return;
    const newName = (this.editingNombreValue() || '').trim();
    this.editingNombreId.set(null);

    if (!newName || newName === item.nombre) return;

    const prevName = item.nombre;
    this.patchItem(item.id, { nombre: newName });

    this.finanzasService.updatePlantillaItem(item.id, { nombre: newName }).subscribe({
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

  cancelInlineNombre(): void {
    this.editingNombreId.set(null);
    this.editingNombreValue.set('');
  }

  // ==========================================
  // ESTILOS VISUALES
  // ==========================================
  getRowClass(item: FinanzasPlantillaItem): string {
    const isSel = this.isItemSelected(item.id);
    if (isSel) {
      return 'bg-primary/10 border-primary/40 ring-1 ring-primary/30';
    }
    if (item.estado === 'completado') {
      return 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15';
    }
    if (item.estado === 'en proceso') {
      return 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15';
    }
    return 'bg-surface border-surface-border hover:bg-surface-border/40';
  }

  getStatusBadgeClass(item: FinanzasPlantillaItem): string {
    if (item.estado === 'completado') {
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30';
    }
    if (item.estado === 'en proceso') {
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30';
    }
    return 'bg-surface-border/40 text-text-muted hover:text-text-main border-surface-border hover:bg-surface-border/60';
  }

  getMontoColorClass(item: FinanzasPlantillaItem): string {
    if (item.estado === 'completado') {
      return 'text-emerald-400 font-bold font-mono';
    }
    if (item.estado === 'en proceso') {
      return 'text-amber-400 font-bold font-mono';
    }
    return item.tipo === 'egreso'
      ? 'text-danger font-semibold font-mono'
      : 'text-success font-semibold font-mono';
  }

  // ==========================================
  // MODAL CREAR / EDITAR
  // ==========================================
  openCreateModal(tipo: TipoMovimientoFinanzas = 'egreso'): void {
    this.isEditingItem.set(false);
    this.editingItemId.set(null);
    this.formTipo.set(tipo);
    this.formNombre.set('');
    this.formMonto.set(null);
    this.formBancoId.set(null);
    this.formGrupoItemId.set(null);
    this.formMovimientoEsperadoId.set(null);
    this.formEstado.set('pendiente');
    this.showItemModal.set(true);
  }

  openEditModal(item: FinanzasPlantillaItem, event?: Event): void {
    event?.stopPropagation();
    this.isEditingItem.set(true);
    this.editingItemId.set(item.id);
    this.formTipo.set(item.tipo);
    this.formNombre.set(item.nombre);
    this.formMonto.set(item.monto);
    this.formBancoId.set(item.banco_id ?? null);
    this.formGrupoItemId.set(item.grupo_item_id ?? null);
    this.formMovimientoEsperadoId.set(item.movimiento_esperado_id ?? null);
    this.formEstado.set(item.estado);
    this.showItemModal.set(true);
  }

  closeItemModal(): void {
    this.showItemModal.set(false);
    this.isEditingItem.set(false);
    this.editingItemId.set(null);
  }

  saveItem(): void {
    const nombre = this.formNombre().trim();
    if (!nombre) {
      this.toastService.error('El nombre del movimiento es obligatorio');
      return;
    }

    const monto = Number(this.formMonto()) || 0;

    if (this.isEditingItem()) {
      const id = this.editingItemId();
      if (!id) {
        this.toastService.error('No se encontró el movimiento a editar');
        return;
      }
      this.isSubmittingItem.set(true);

      this.finanzasService
        .updatePlantillaItem(id, {
          nombre,
          monto,
          tipo: this.formTipo(),
          banco_id: this.formBancoId(),
          grupo_item_id: this.formGrupoItemId(),
          movimiento_esperado_id: this.formMovimientoEsperadoId(),
          estado: this.formEstado(),
          mes: this.selectedMes(),
          anio: this.selectedAnio(),
        })
        .subscribe({
          next: () => {
            this.toastService.success('Movimiento actualizado');
            this.isSubmittingItem.set(false);
            this.closeItemModal();
            this.reload.emit();
          },
          error: (err) => {
            this.toastService.error('Error al actualizar movimiento');
            this.isSubmittingItem.set(false);
            console.error(err);
          },
        });
    } else {
      this.isSubmittingItem.set(true);
      const req: FinanzasPlantillaRequest = {
        tipo: this.formTipo(),
        nombre,
        monto,
        mes: this.selectedMes(),
        anio: this.selectedAnio(),
        estado: this.formEstado(),
        banco_id: this.formBancoId(),
        grupo_item_id: this.formTipo() === 'egreso' ? this.formGrupoItemId() : null,
        movimiento_esperado_id:
          this.formTipo() === 'egreso' ? this.formMovimientoEsperadoId() : null,
      };

      this.finanzasService.createPlantillaItem(req).subscribe({
        next: () => {
          this.toastService.success('Movimiento creado');
          this.isSubmittingItem.set(false);
          this.closeItemModal();
          this.reload.emit();
        },
        error: (err) => {
          this.toastService.error('Error al crear movimiento');
          this.isSubmittingItem.set(false);
          console.error(err);
        },
      });
    }
  }

  // Creación rápida inline
  createQuick(): void {
    const nombre = this.quickNombre().trim();
    if (!nombre) return;

    this.isSubmittingQuick.set(true);
    const monto = Number(this.quickMonto()) || 0;

    const req: FinanzasPlantillaRequest = {
      tipo: this.quickTipo(),
      nombre,
      monto,
      mes: this.selectedMes(),
      anio: this.selectedAnio(),
      estado: 'pendiente',
      banco_id: this.quickBancoId(),
      grupo_item_id: this.quickTipo() === 'egreso' ? this.quickGrupoId() : null,
    };

    this.finanzasService.createPlantillaItem(req).subscribe({
      next: () => {
        this.toastService.success('Movimiento agregado');
        this.quickNombre.set('');
        this.quickMonto.set(null);
        this.isSubmittingQuick.set(false);
        this.reload.emit();
      },
      error: (err) => {
        this.toastService.error('Error al crear movimiento');
        this.isSubmittingQuick.set(false);
        console.error(err);
      },
    });
  }

  // Borrado de ítem individual
  requestDelete(item: FinanzasPlantillaItem, event?: Event): void {
    event?.stopPropagation();
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

  // ==========================================
  // CLONACIÓN DE PERÍODO
  // ==========================================
  openCloneModal(): void {
    const mesOrig = this.selectedMes();
    const anioOrig = this.selectedAnio();

    let mesDest = mesOrig + 1;
    let anioDest = anioOrig;
    if (mesDest > 12) {
      mesDest = 1;
      anioDest += 1;
    }

    this.cloneMesOrigen.set(mesOrig);
    this.cloneAnioOrigen.set(anioOrig);
    this.cloneMesDestino.set(mesDest);
    this.cloneAnioDestino.set(anioDest);
    this.showCloneModal.set(true);
  }

  closeCloneModal(): void {
    this.showCloneModal.set(false);
  }

  submitClone(): void {
    this.isSubmittingClone.set(true);
    const req: ClonarPeriodoRequest = {
      anio_origen: Number(this.cloneAnioOrigen()),
      mes_origen: Number(this.cloneMesOrigen()),
      anio_destino: Number(this.cloneAnioDestino()),
      mes_destino: Number(this.cloneMesDestino()),
    };

    this.finanzasService.clonarPeriodo(req).subscribe({
      next: (res) => {
        this.toastService.success(
          `¡Éxito! Se clonaron ${res.registros_clonados} movimientos a ${this.meses()[req.mes_destino - 1]} ${req.anio_destino}`
        );
        this.isSubmittingClone.set(false);
        this.closeCloneModal();
        this.periodoChange.emit({ mes: req.mes_destino, anio: req.anio_destino });
      },
      error: (err) => {
        this.toastService.error('Error al clonar el período: ' + getErrorMessage(err, err.message ?? 'error desconocido'));
        this.isSubmittingClone.set(false);
        console.error(err);
      },
    });
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(val || 0);
  }
}
