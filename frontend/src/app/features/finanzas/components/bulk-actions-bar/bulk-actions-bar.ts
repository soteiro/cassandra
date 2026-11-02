import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import {
  LucideCheck,
  LucideChevronDown,
  LucideClock,
  LucideLandmark,
  LucideTag,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { Banco, EstadoFinanzas, GrupoItemFinanzas } from '../../data/finanzas.model';
import { formatCLP } from '../../utils/presupuesto.util';

/** Barra flotante con las acciones sobre los movimientos seleccionados. */
@Component({
  selector: 'app-bulk-actions-bar',
  imports: [
    LucideCheck,
    LucideChevronDown,
    LucideClock,
    LucideLandmark,
    LucideTag,
    LucideTrash2,
    LucideX,
  ],
  templateUrl: './bulk-actions-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'closeMenus()' },
})
export class BulkActionsBar {
  readonly count = input.required<number>();
  readonly total = input.required<number>();
  readonly processing = input<boolean>(false);
  readonly bancos = input<Banco[]>([]);
  readonly grupos = input<GrupoItemFinanzas[]>([]);

  readonly estadoChange = output<EstadoFinanzas>();
  readonly categoriaChange = output<number | null>();
  readonly bancoChange = output<number | null>();
  readonly remove = output<void>();
  readonly clear = output<void>();

  protected readonly formatCLP = formatCLP;

  showBulkCategoryMenu = signal<boolean>(false);
  showBulkBancoMenu = signal<boolean>(false);

  closeMenus(): void {
    this.showBulkCategoryMenu.set(false);
    this.showBulkBancoMenu.set(false);
  }
}
