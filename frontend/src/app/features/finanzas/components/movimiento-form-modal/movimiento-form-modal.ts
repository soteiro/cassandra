import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideWallet, LucideX } from '@lucide/angular';
import { FinanzasService } from '../../data/finanzas.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { BackButtonService } from '../../../../core/platform/back-button.service';
import {
  Banco,
  EstadoFinanzas,
  FinanzasPlantillaItem,
  FinanzasPlantillaRequest,
  GrupoItemFinanzas,
  MovimientoEsperadoFinanzas,
  TipoMovimientoFinanzas,
} from '../../data/finanzas.model';

/** Modal para crear un movimiento o editar todos sus campos. Se abre con `openCreate`/`openEdit`. */
@Component({
  selector: 'app-movimiento-form-modal',
  imports: [FormsModule, LucideWallet, LucideX],
  templateUrl: './movimiento-form-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovimientoFormModal {
  readonly mes = input.required<number>();
  readonly anio = input.required<number>();
  readonly bancos = input<Banco[]>([]);
  readonly grupos = input<GrupoItemFinanzas[]>([]);
  readonly movimientosEsperados = input<MovimientoEsperadoFinanzas[]>([]);

  readonly saved = output<void>();

  private readonly finanzasService = inject(FinanzasService);
  private readonly toastService = inject(ToastService);
  private readonly backButtonService = inject(BackButtonService);

  showItemModal = signal<boolean>(false);
  isEditingItem = signal<boolean>(false);
  editingItemId = signal<number | null>(null);
  isSubmittingItem = signal<boolean>(false);

  private readonly _backBtn = this.backButtonService.registerEffect(
    () => this.showItemModal(),
    () => this.closeItemModal(),
    80,
  );

  formTipo = signal<TipoMovimientoFinanzas>('egreso');
  formNombre = signal<string>('');
  formMonto = signal<number | null>(null);
  formBancoId = signal<number | null>(null);
  formGrupoItemId = signal<number | null>(null);
  formMovimientoEsperadoId = signal<number | null>(null);
  formEstado = signal<EstadoFinanzas>('pendiente');

  openCreate(tipo: TipoMovimientoFinanzas = 'egreso'): void {
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

  openEdit(item: FinanzasPlantillaItem): void {
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
          mes: this.mes(),
          anio: this.anio(),
        })
        .subscribe({
          next: () => {
            this.toastService.success('Movimiento actualizado');
            this.isSubmittingItem.set(false);
            this.closeItemModal();
            this.saved.emit();
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
        mes: this.mes(),
        anio: this.anio(),
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
          this.saved.emit();
        },
        error: (err) => {
          this.toastService.error('Error al crear movimiento');
          this.isSubmittingItem.set(false);
          console.error(err);
        },
      });
    }
  }
}
