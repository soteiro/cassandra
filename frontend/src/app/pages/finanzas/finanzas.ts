import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanzasService } from '../../services/finanzas.service';
import { ToastService } from '../../services/toast.service';
import {
  Banco,
  ClonarPeriodoRequest,
  EstadoFinanzas,
  FinanzasPlantillaItem,
  FinanzasPlantillaRequest,
  FinanzasResumenPeriodo,
  GrupoItemFinanzas,
  MovimientoEsperadoFinanzas,
  TipoBanco,
  TipoMovimientoFinanzas,
} from '../../models/finanzas.model';
import { ConfirmModal } from '../../components/confirm-modal/confirm-modal';
import {
  LucideWallet,
  LucideTrendingUp,
  LucideTrendingDown,
  LucideScale,
  LucidePlus,
  LucideRefreshCcw,
  LucideCopy,
  LucideChevronLeft,
  LucideChevronRight,
  LucideCalendar,
  LucideTrash2,
  LucidePencil,
  LucideCheck,
  LucideDollarSign,
  LucideLandmark,
  LucideTag,
  LucideArrowUpRight,
  LucideArrowDownRight,
  LucideClock,
  LucideSettings,
  LucideX,
  LucideSlidersHorizontal,
  LucideCheckCircle2,
} from '@lucide/angular';

@Component({
  selector: 'app-finanzas',
  imports: [
    CommonModule,
    FormsModule,
    ConfirmModal,
    LucideWallet,
    LucideScale,
    LucidePlus,
    LucideRefreshCcw,
    LucideCopy,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCalendar,
    LucideTrash2,
    LucidePencil,
    LucideCheck,
    LucideLandmark,
    LucideTag,
    LucideArrowUpRight,
    LucideArrowDownRight,
    LucideSettings,
    LucideX,
    LucideSlidersHorizontal,
  ],
  templateUrl: './finanzas.html',
  styleUrl: './finanzas.css',
})
export class Finanzas implements OnInit {
  private readonly finanzasService = inject(FinanzasService);
  private readonly toastService = inject(ToastService);

  readonly meses = [
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

  readonly tiposBanco: { value: TipoBanco; label: string }[] = [
    { value: 'debito', label: 'Débito' },
    { value: 'credito', label: 'Crédito' },
    { value: 'prepago', label: 'Prepago / Billetera' },
    { value: 'efectivo', label: 'Efectivo' },
  ];

  // Estado del período seleccionado
  selectedAnio = signal<number>(new Date().getFullYear());
  selectedMes = signal<number>(new Date().getMonth() + 1); // 1-12

  // Estado de los datos
  items = signal<FinanzasPlantillaItem[]>([]);
  resumen = signal<FinanzasResumenPeriodo>({
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
    total_ingresos: 0,
    total_egresos: 0,
    balance: 0,
  });

  // Catálogos
  bancos = signal<Banco[]>([]);
  grupos = signal<GrupoItemFinanzas[]>([]);
  movimientosEsperados = signal<MovimientoEsperadoFinanzas[]>([]);

  // Estados de carga y navegación
  isLoading = signal<boolean>(false);
  isRotating = signal<boolean>(false);
  activeTab = signal<'movimientos' | 'catalogos'>('movimientos');
  statusFilter = signal<'all' | 'pendientes' | 'completados'>('all');
  searchQuery = signal<string>('');

  // Modal de Crear / Editar Movimiento
  showItemModal = signal<boolean>(false);
  isEditingItem = signal<boolean>(false);
  editingItemId = signal<number | null>(null);
  isSubmittingItem = signal<boolean>(false);

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
  cloneAnioDestino = signal<number>(new Date().getFullYear());
  cloneMesDestino = signal<number>(new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2);
  isSubmittingClone = signal<boolean>(false);

  // Modal de Confirmación de Borrado
  itemToDelete = signal<FinanzasPlantillaItem | null>(null);
  isDeletingItem = signal<boolean>(false);

  // Creación rápida inline
  quickTipo = signal<TipoMovimientoFinanzas>('egreso');
  quickNombre = signal<string>('');
  quickMonto = signal<number | null>(null);
  quickBancoId = signal<number | null>(null);
  quickGrupoId = signal<number | null>(null);
  isSubmittingQuick = signal<boolean>(false);

  // Formularios de nuevos catálogos
  newBancoNombre = signal<string>('');
  newBancoTipo = signal<TipoBanco>('debito');
  isSubmittingBanco = signal<boolean>(false);

  newGrupoNombre = signal<string>('');
  isSubmittingGrupo = signal<boolean>(false);

  newMovimientoNombre = signal<string>('');
  isSubmittingMovimiento = signal<boolean>(false);

  // Computados
  mesNombre = computed(() => this.meses[this.selectedMes() - 1]);

  ingresos = computed(() => {
    let list = this.items().filter((i) => i.tipo === 'ingreso');
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
    } else if (status === 'completados') {
      list = list.filter((i) => i.estado === 'completado');
    }
    return list;
  });

  egresos = computed(() => {
    let list = this.items().filter((i) => i.tipo === 'egreso');
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
    } else if (status === 'completados') {
      list = list.filter((i) => i.estado === 'completado');
    }
    return list;
  });

  porcentajeConsumido = computed(() => {
    const ing = this.resumen().total_ingresos;
    const egr = this.resumen().total_egresos;
    if (ing <= 0) return egr > 0 ? 100 : 0;
    return Math.min(Math.round((egr / ing) * 100), 100);
  });

  porcentajeReal = computed(() => {
    const ing = this.resumen().total_ingresos;
    const egr = this.resumen().total_egresos;
    if (ing <= 0) return egr > 0 ? 100 : 0;
    return Math.round((egr / ing) * 100);
  });

  ngOnInit(): void {
    this.loadCatalogs();
    this.loadPeriodo();
  }

  loadCatalogs(): void {
    this.finanzasService.getBancos().subscribe({
      next: (b) => this.bancos.set(b || []),
      error: (err) => console.error('Error cargando bancos:', err),
    });

    this.finanzasService.getGrupos().subscribe({
      next: (g) => this.grupos.set(g || []),
      error: (err) => console.error('Error cargando categorías:', err),
    });

    this.finanzasService.getMovimientosEsperados().subscribe({
      next: (m) => this.movimientosEsperados.set(m || []),
      error: (err) => console.error('Error cargando movimientos esperados:', err),
    });
  }

  loadPeriodo(): void {
    this.isLoading.set(true);
    const anio = this.selectedAnio();
    const mes = this.selectedMes();

    // Cargar ítems y resumen concurrentemente
    this.finanzasService.getPlantilla(anio, mes).subscribe({
      next: (items) => {
        this.items.set(items || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando plantilla:', err);
        this.toastService.error('Error al cargar movimientos del período');
        this.isLoading.set(false);
      },
    });

    this.finanzasService.getResumen(anio, mes).subscribe({
      next: (res) => {
        this.resumen.set(
          res || {
            mes,
            anio,
            total_ingresos: 0,
            total_egresos: 0,
            balance: 0,
          }
        );
      },
      error: (err) => console.error('Error cargando resumen:', err),
    });
  }

  reload(): void {
    this.isRotating.set(true);
    this.loadCatalogs();
    this.loadPeriodo();
    setTimeout(() => this.isRotating.set(false), 600);
  }

  // ==========================================
  // NAVEGACIÓN TEMPORAL
  // ==========================================
  prevMonth(): void {
    let m = this.selectedMes() - 1;
    let a = this.selectedAnio();
    if (m < 1) {
      m = 12;
      a -= 1;
    }
    this.selectedMes.set(m);
    this.selectedAnio.set(a);
    this.loadPeriodo();
  }

  nextMonth(): void {
    let m = this.selectedMes() + 1;
    let a = this.selectedAnio();
    if (m > 12) {
      m = 1;
      a += 1;
    }
    this.selectedMes.set(m);
    this.selectedAnio.set(a);
    this.loadPeriodo();
  }

  goToCurrentMonth(): void {
    const now = new Date();
    this.selectedMes.set(now.getMonth() + 1);
    this.selectedAnio.set(now.getFullYear());
    this.loadPeriodo();
  }

  setPeriodo(mes: number, anio: number): void {
    this.selectedMes.set(mes);
    this.selectedAnio.set(anio);
    this.loadPeriodo();
  }

  // ==========================================
  // OPERACIONES DE ITEMS
  // ==========================================
  toggleItemEstado(item: FinanzasPlantillaItem): void {
    const nuevoEstado: EstadoFinanzas =
      item.estado === 'completado' ? 'pendiente' : 'completado';
    const prevEstado = item.estado;

    // Actualización optimista
    item.estado = nuevoEstado;

    this.finanzasService.updatePlantillaItem(item.id, { estado: nuevoEstado }).subscribe({
      next: () => {
        if (nuevoEstado === 'completado') {
          this.toastService.success(`"${item.nombre}" marcado como completado`);
        }
      },
      error: (err) => {
        item.estado = prevEstado;
        this.toastService.error('Error al cambiar estado del movimiento');
        console.error('Error actualizando estado:', err);
      },
    });
  }

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

  openEditModal(item: FinanzasPlantillaItem): void {
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
    this.isSubmittingItem.set(true);

    if (this.isEditingItem()) {
      const id = this.editingItemId();
      if (!id) return;

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
            this.loadPeriodo();
          },
          error: (err) => {
            this.toastService.error('Error al actualizar movimiento');
            this.isSubmittingItem.set(false);
            console.error(err);
          },
        });
    } else {
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
          this.loadPeriodo();
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
        this.loadPeriodo();
      },
      error: (err) => {
        this.toastService.error('Error al crear movimiento');
        this.isSubmittingQuick.set(false);
        console.error(err);
      },
    });
  }

  // Borrado de ítem
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
        this.loadPeriodo();
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
          `¡Éxito! Se clonaron ${res.registros_clonados} movimientos a ${this.meses[req.mes_destino - 1]} ${req.anio_destino}`
        );
        this.isSubmittingClone.set(false);
        this.closeCloneModal();
        // Navegar directamente al mes destino
        this.selectedMes.set(req.mes_destino);
        this.selectedAnio.set(req.anio_destino);
        this.loadPeriodo();
      },
      error: (err) => {
        this.toastService.error('Error al clonar el período: ' + (err.error || err.message));
        this.isSubmittingClone.set(false);
        console.error(err);
      },
    });
  }

  // ==========================================
  // ADMINISTRACIÓN DE CATÁLOGOS
  // ==========================================
  createBanco(): void {
    const nombre = this.newBancoNombre().trim();
    if (!nombre) return;

    this.isSubmittingBanco.set(true);
    this.finanzasService
      .createBanco({ nombre, tipo: this.newBancoTipo() })
      .subscribe({
        next: () => {
          this.toastService.success(`Cuenta "${nombre}" agregada`);
          this.newBancoNombre.set('');
          this.isSubmittingBanco.set(false);
          this.loadCatalogs();
        },
        error: (err) => {
          this.toastService.error('Error al crear banco/cuenta');
          this.isSubmittingBanco.set(false);
          console.error(err);
        },
      });
  }

  deleteBanco(id: number): void {
    this.finanzasService.deleteBanco(id).subscribe({
      next: () => {
        this.toastService.success('Cuenta eliminada');
        this.loadCatalogs();
      },
      error: (err) => {
        this.toastService.error('Error al eliminar cuenta');
        console.error(err);
      },
    });
  }

  createGrupo(): void {
    const nombre = this.newGrupoNombre().trim();
    if (!nombre) return;

    this.isSubmittingGrupo.set(true);
    this.finanzasService.createGrupo({ nombre }).subscribe({
      next: () => {
        this.toastService.success(`Categoría "${nombre}" agregada`);
        this.newGrupoNombre.set('');
        this.isSubmittingGrupo.set(false);
        this.loadCatalogs();
      },
      error: (err) => {
        this.toastService.error('Error al crear categoría');
        this.isSubmittingGrupo.set(false);
        console.error(err);
      },
    });
  }

  deleteGrupo(id: number): void {
    this.finanzasService.deleteGrupo(id).subscribe({
      next: () => {
        this.toastService.success('Categoría eliminada');
        this.loadCatalogs();
      },
      error: (err) => {
        this.toastService.error('Error al eliminar categoría');
        console.error(err);
      },
    });
  }

  createMovimientoEsperado(): void {
    const nombre = this.newMovimientoNombre().trim();
    if (!nombre) return;

    this.isSubmittingMovimiento.set(true);
    this.finanzasService.createMovimientoEsperado({ nombre }).subscribe({
      next: () => {
        this.toastService.success(`Mecanismo "${nombre}" agregado`);
        this.newMovimientoNombre.set('');
        this.isSubmittingMovimiento.set(false);
        this.loadCatalogs();
      },
      error: (err) => {
        this.toastService.error('Error al crear mecanismo de pago');
        this.isSubmittingMovimiento.set(false);
        console.error(err);
      },
    });
  }

  deleteMovimientoEsperado(id: number): void {
    this.finanzasService.deleteMovimientoEsperado(id).subscribe({
      next: () => {
        this.toastService.success('Mecanismo de pago eliminado');
        this.loadCatalogs();
      },
      error: (err) => {
        this.toastService.error('Error al eliminar mecanismo');
        console.error(err);
      },
    });
  }

  // ==========================================
  // FORMATO
  // ==========================================
  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(val || 0);
  }
}
