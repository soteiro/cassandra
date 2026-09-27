import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanzasService } from '../../../../services/finanzas.service';
import { ToastService } from '../../../../services/toast.service';
import {
  GrupoItemFinanzas,
  ListaDeseosItem,
} from '../../../../models/finanzas.model';
import { ConfirmModal } from '../../../../components/confirm-modal/confirm-modal';
import {
  LucideSparkles,
  LucideCheckCircle2,
  LucideScale,
  LucideX,
  LucidePlus,
  LucideCheck,
  LucideTag,
  LucidePencil,
  LucideTrash2,
  LucideClock,
} from '@lucide/angular';

@Component({
  selector: 'app-deseos-tab',
  imports: [
    CommonModule,
    FormsModule,
    ConfirmModal,
    LucideSparkles,
    LucideCheckCircle2,
    LucideScale,
    LucideX,
    LucidePlus,
    LucideCheck,
    LucideTag,
    LucidePencil,
    LucideTrash2,
    LucideClock,
  ],
  templateUrl: './deseos-tab.html',
})
export class DeseosTab implements OnInit {
  grupos = input<GrupoItemFinanzas[]>([]);

  pendingCountChange = output<number>();

  private readonly finanzasService = inject(FinanzasService);
  private readonly toastService = inject(ToastService);

  listaDeseos = signal<ListaDeseosItem[]>([]);
  isLoadingDeseos = signal<boolean>(false);
  filtroDeseos = signal<'todos' | 'pendientes' | 'comprados'>('todos');
  filtroDeseosGrupo = signal<number | null>(null);
  busquedaDeseos = signal<string>('');

  // Modal Crear/Editar Deseo
  showDeseoModal = signal<boolean>(false);
  isEditingDeseo = signal<boolean>(false);
  editingDeseoId = signal<number | null>(null);
  isSubmittingDeseo = signal<boolean>(false);

  formDeseoNombre = signal<string>('');
  formDeseoPresupuesto = signal<number | null>(null);
  formDeseoValorEstimado = signal<number | null>(null);
  formDeseoJustificacion = signal<string>('');
  formDeseoGrupoId = signal<number | null>(null);
  formDeseoComprado = signal<boolean>(false);

  // Modal Confirmar Borrado Deseo
  deseoToDelete = signal<ListaDeseosItem | null>(null);
  isDeletingDeseo = signal<boolean>(false);

  // Computados
  deseosFiltrados = computed(() => {
    let list = this.listaDeseos();
    const q = this.busquedaDeseos().toLowerCase().trim();
    if (q) {
      list = list.filter(
        (d) =>
          d.nombre.toLowerCase().includes(q) ||
          (d.justificacion && d.justificacion.toLowerCase().includes(q)) ||
          (d.grupo_item_finanzas_nombre && d.grupo_item_finanzas_nombre.toLowerCase().includes(q))
      );
    }
    const f = this.filtroDeseos();
    if (f === 'pendientes') {
      list = list.filter((d) => !d.comprado);
    } else if (f === 'comprados') {
      list = list.filter((d) => d.comprado);
    }
    const grupo = this.filtroDeseosGrupo();
    if (grupo !== null) {
      list = list.filter((d) => d.grupo_item_finanzas_id === grupo);
    }
    return list;
  });

  totalPresupuestoDeseos = computed(() =>
    this.listaDeseos().reduce((acc, d) => acc + (d.presupuesto || 0), 0)
  );

  totalEstimadoPendienteDeseos = computed(() =>
    this.listaDeseos().filter((d) => !d.comprado).reduce((acc, d) => acc + (d.valor_estimado || 0), 0)
  );

  totalEstimadoCompradoDeseos = computed(() =>
    this.listaDeseos().filter((d) => d.comprado).reduce((acc, d) => acc + (d.valor_estimado || 0), 0)
  );

  deseosPendientesCount = computed(
    () => this.listaDeseos().filter((d) => !d.comprado).length
  );

  deseosCompradosCount = computed(
    () => this.listaDeseos().filter((d) => d.comprado).length
  );

  ngOnInit(): void {
    this.loadListaDeseos();
  }

  loadListaDeseos(): void {
    this.isLoadingDeseos.set(true);
    this.finanzasService.getListaDeseos().subscribe({
      next: (deseos) => {
        const items = deseos || [];
        this.listaDeseos.set(items);
        this.isLoadingDeseos.set(false);
        this.pendingCountChange.emit(items.filter((d) => !d.comprado).length);
      },
      error: (err) => {
        console.error('Error cargando lista de deseos:', err);
        this.isLoadingDeseos.set(false);
      },
    });
  }

  openCreateDeseoModal(): void {
    this.isEditingDeseo.set(false);
    this.editingDeseoId.set(null);
    this.formDeseoNombre.set('');
    this.formDeseoPresupuesto.set(null);
    this.formDeseoValorEstimado.set(null);
    this.formDeseoJustificacion.set('');
    this.formDeseoGrupoId.set(null);
    this.formDeseoComprado.set(false);
    this.showDeseoModal.set(true);
  }

  openEditDeseoModal(item: ListaDeseosItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.isEditingDeseo.set(true);
    this.editingDeseoId.set(item.id);
    this.formDeseoNombre.set(item.nombre);
    this.formDeseoPresupuesto.set(item.presupuesto);
    this.formDeseoValorEstimado.set(item.valor_estimado);
    this.formDeseoJustificacion.set(item.justificacion || '');
    this.formDeseoGrupoId.set(item.grupo_item_finanzas_id || null);
    this.formDeseoComprado.set(item.comprado);
    this.showDeseoModal.set(true);
  }

  closeDeseoModal(): void {
    this.showDeseoModal.set(false);
  }

  saveDeseo(): void {
    const nombre = this.formDeseoNombre().trim();
    if (!nombre) {
      this.toastService.error('El nombre del deseo es obligatorio');
      return;
    }

    this.isSubmittingDeseo.set(true);
    if (this.isEditingDeseo() && this.editingDeseoId()) {
      const id = this.editingDeseoId()!;
      this.finanzasService
        .updateListaDeseos(id, {
          nombre,
          presupuesto: this.formDeseoPresupuesto() || 0,
          valor_estimado: this.formDeseoValorEstimado() || 0,
          comprado: this.formDeseoComprado(),
          justificacion: this.formDeseoJustificacion().trim() || null,
          grupo_item_finanzas_id: this.formDeseoGrupoId() ? Number(this.formDeseoGrupoId()) : null,
        })
        .subscribe({
          next: (updated) => {
            this.listaDeseos.update((items) =>
              items.map((i) => (i.id === id ? updated : i))
            );
            this.toastService.success('Deseo actualizado correctamente');
            this.closeDeseoModal();
            this.isSubmittingDeseo.set(false);
            this.pendingCountChange.emit(this.deseosPendientesCount());
          },
          error: (err) => {
            console.error('Error actualizando deseo:', err);
            this.toastService.error('No se pudo actualizar el deseo');
            this.isSubmittingDeseo.set(false);
          },
        });
    } else {
      this.finanzasService
        .createListaDeseos({
          nombre,
          presupuesto: this.formDeseoPresupuesto() || 0,
          valor_estimado: this.formDeseoValorEstimado() || 0,
          comprado: this.formDeseoComprado(),
          justificacion: this.formDeseoJustificacion().trim() || null,
          grupo_item_finanzas_id: this.formDeseoGrupoId() ? Number(this.formDeseoGrupoId()) : null,
        })
        .subscribe({
          next: (created) => {
            this.listaDeseos.update((items) => [created, ...items]);
            this.toastService.success('Deseo agregado a la lista');
            this.closeDeseoModal();
            this.isSubmittingDeseo.set(false);
            this.pendingCountChange.emit(this.deseosPendientesCount());
          },
          error: (err) => {
            console.error('Error creando deseo:', err);
            this.toastService.error('No se pudo crear el deseo');
            this.isSubmittingDeseo.set(false);
          },
        });
    }
  }

  toggleCompradoDeseo(item: ListaDeseosItem, event?: Event): void {
    if (event) event.stopPropagation();
    const nuevoEstado = !item.comprado;
    this.finanzasService
      .updateListaDeseos(item.id, { comprado: nuevoEstado })
      .subscribe({
        next: (updated) => {
          this.listaDeseos.update((items) =>
            items.map((i) => (i.id === item.id ? updated : i))
          );
          if (nuevoEstado) {
            this.toastService.success(`¡Deseo cumplido! "${item.nombre}" marcado como comprado.`);
          } else {
            this.toastService.info(`"${item.nombre}" vuelto a marcar como pendiente.`);
          }
          this.pendingCountChange.emit(this.deseosPendientesCount());
        },
        error: (err) => {
          console.error('Error cambiando estado del deseo:', err);
          this.toastService.error('Error al cambiar estado');
        },
      });
  }

  promptDeleteDeseo(item: ListaDeseosItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.deseoToDelete.set(item);
  }

  confirmDeleteDeseo(): void {
    const item = this.deseoToDelete();
    if (!item) return;
    this.isDeletingDeseo.set(true);
    this.finanzasService.deleteListaDeseos(item.id).subscribe({
      next: () => {
        this.listaDeseos.update((items) => items.filter((i) => i.id !== item.id));
        this.toastService.success('Deseo eliminado');
        this.deseoToDelete.set(null);
        this.isDeletingDeseo.set(false);
        this.pendingCountChange.emit(this.deseosPendientesCount());
      },
      error: (err) => {
        console.error('Error eliminando deseo:', err);
        this.toastService.error('Error al eliminar deseo');
        this.isDeletingDeseo.set(false);
      },
    });
  }

  cancelDeleteDeseo(): void {
    this.deseoToDelete.set(null);
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(val || 0);
  }
}
