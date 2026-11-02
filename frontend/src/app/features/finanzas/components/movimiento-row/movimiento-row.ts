import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideCheck,
  LucideChevronDown,
  LucideClock,
  LucidePencil,
  LucideSlidersHorizontal,
  LucideTrash2,
} from '@lucide/angular';
import { EstadoFinanzas, FinanzasPlantillaItem } from '../../data/finanzas.model';
import {
  FinanzasGroupMode,
  formatCLP,
  getMontoColorClass,
  getRowClass,
  getStatusBadgeClass,
  siguienteEstado,
} from '../../utils/presupuesto.util';

/**
 * Fila de un movimiento: selección, estado (clic para avanzar o menú), edición inline de
 * concepto y monto, y accesos a editar o eliminar. Solo emite intenciones; el padre persiste.
 */
@Component({
  selector: 'app-movimiento-row',
  imports: [
    FormsModule,
    LucideCheck,
    LucideChevronDown,
    LucideClock,
    LucidePencil,
    LucideSlidersHorizontal,
    LucideTrash2,
  ],
  templateUrl: './movimiento-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class MovimientoRow {
  readonly movimiento = input.required<FinanzasPlantillaItem>();
  readonly selected = input<boolean>(false);
  readonly menuOpen = input<boolean>(false);
  readonly groupMode = input<FinanzasGroupMode>('categoria');

  readonly selectToggle = output<void>();
  readonly menuToggle = output<void>();
  readonly estadoChange = output<EstadoFinanzas>();
  readonly nombreChange = output<string>();
  readonly montoChange = output<number>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  protected readonly formatCLP = formatCLP;
  protected readonly rowClass = computed(() => getRowClass(this.movimiento(), this.selected()));
  protected readonly statusBadgeClass = computed(() => getStatusBadgeClass(this.movimiento()));
  protected readonly montoColorClass = computed(() => getMontoColorClass(this.movimiento()));

  readonly editingNombre = signal(false);
  readonly editingNombreValue = signal<string>('');
  readonly editingMonto = signal(false);
  readonly editingMontoValue = signal<number | null>(null);

  onToggleSelect(event: Event): void {
    event.stopPropagation();
    this.selectToggle.emit();
  }

  onToggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuToggle.emit();
  }

  cycleEstado(event?: Event): void {
    event?.stopPropagation();
    this.estadoChange.emit(siguienteEstado(this.movimiento().estado));
  }

  selectEstado(estado: EstadoFinanzas, event?: Event): void {
    event?.stopPropagation();
    this.estadoChange.emit(estado);
  }

  startNombre(event?: Event): void {
    event?.stopPropagation();
    this.editingNombre.set(true);
    this.editingNombreValue.set(this.movimiento().nombre);
    this.focusInput(`inline-nombre-${this.movimiento().id}`);
  }

  saveNombre(): void {
    if (!this.editingNombre()) return;
    const newName = (this.editingNombreValue() || '').trim();
    this.editingNombre.set(false);
    if (newName && newName !== this.movimiento().nombre) {
      this.nombreChange.emit(newName);
    }
  }

  cancelNombre(): void {
    this.editingNombre.set(false);
    this.editingNombreValue.set('');
  }

  startMonto(event?: Event): void {
    event?.stopPropagation();
    this.editingMonto.set(true);
    this.editingMontoValue.set(this.movimiento().monto);
    this.focusInput(`inline-monto-${this.movimiento().id}`);
  }

  saveMonto(): void {
    if (!this.editingMonto()) return;
    const rawVal = this.editingMontoValue();
    this.editingMonto.set(false);
    if (rawVal === null || rawVal === undefined) return;
    const newVal = Number(rawVal);
    if (!isNaN(newVal) && newVal !== this.movimiento().monto) {
      this.montoChange.emit(newVal);
    }
  }

  cancelMonto(): void {
    this.editingMonto.set(false);
    this.editingMontoValue.set(null);
  }

  onEdit(event: Event): void {
    event.stopPropagation();
    this.edit.emit();
  }

  onRemove(event: Event): void {
    event.stopPropagation();
    this.remove.emit();
  }

  // El input aparece en el siguiente render; se enfoca y selecciona para escribir encima.
  private focusInput(id: string): void {
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }, 40);
  }
}
