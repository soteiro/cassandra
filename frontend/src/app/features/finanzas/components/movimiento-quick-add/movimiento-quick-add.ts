import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCheck, LucideClock, LucidePlus } from '@lucide/angular';
import { FinanzasService } from '../../data/finanzas.service';
import { ToastService } from '../../../../shared/services/toast.service';
import {
  Banco,
  FinanzasPlantillaRequest,
  GrupoItemFinanzas,
  TipoMovimientoFinanzas,
} from '../../data/finanzas.model';
import { FiltroEstadoFinanzas } from '../../utils/presupuesto.util';

/** Barra para agregar un movimiento en una línea; también aloja el filtro por estado. */
@Component({
  selector: 'app-movimiento-quick-add',
  imports: [FormsModule, LucidePlus, LucideClock, LucideCheck],
  templateUrl: './movimiento-quick-add.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class MovimientoQuickAdd {
  readonly mes = input.required<number>();
  readonly anio = input.required<number>();
  readonly bancos = input<Banco[]>([]);
  readonly grupos = input<GrupoItemFinanzas[]>([]);
  readonly statusFilter = model<FiltroEstadoFinanzas>('all');

  readonly created = output<void>();

  private readonly finanzasService = inject(FinanzasService);
  private readonly toastService = inject(ToastService);

  quickTipo = signal<TipoMovimientoFinanzas>('egreso');
  quickNombre = signal<string>('');
  quickMonto = signal<number | null>(null);
  quickBancoId = signal<number | null>(null);
  quickGrupoId = signal<number | null>(null);
  isSubmittingQuick = signal<boolean>(false);

  createQuick(): void {
    const nombre = this.quickNombre().trim();
    if (!nombre) return;

    this.isSubmittingQuick.set(true);
    const monto = Number(this.quickMonto()) || 0;

    const req: FinanzasPlantillaRequest = {
      tipo: this.quickTipo(),
      nombre,
      monto,
      mes: this.mes(),
      anio: this.anio(),
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
        this.created.emit();
      },
      error: (err) => {
        this.toastService.error('Error al crear movimiento');
        this.isSubmittingQuick.set(false);
        console.error(err);
      },
    });
  }
}
