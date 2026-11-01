import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCopy, LucideX } from '@lucide/angular';
import { FinanzasService } from '../../data/finanzas.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { BackButtonService } from '../../../../core/platform/back-button.service';
import { ClonarPeriodoRequest } from '../../data/finanzas.model';
import { getErrorMessage } from '../../../../shared/utils/http-error.util';

/** Modal para copiar los movimientos de un mes a otro. Se abre con `open`, desde el período actual. */
@Component({
  selector: 'app-clonar-periodo-modal',
  imports: [FormsModule, LucideCopy, LucideX],
  templateUrl: './clonar-periodo-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClonarPeriodoModal {
  readonly mes = input.required<number>();
  readonly anio = input.required<number>();
  readonly meses = input.required<string[]>();

  readonly cloned = output<{ mes: number; anio: number }>();

  private readonly finanzasService = inject(FinanzasService);
  private readonly toastService = inject(ToastService);
  private readonly backButtonService = inject(BackButtonService);

  showCloneModal = signal<boolean>(false);
  cloneAnioOrigen = signal<number>(0);
  cloneMesOrigen = signal<number>(1);
  cloneAnioDestino = signal<number>(0);
  cloneMesDestino = signal<number>(1);
  isSubmittingClone = signal<boolean>(false);

  private readonly _backBtn = this.backButtonService.registerEffect(
    () => this.showCloneModal(),
    () => this.closeCloneModal(),
    80,
  );

  /** Abre el modal con el período actual como origen y el mes siguiente como destino. */
  open(): void {
    const mesOrig = this.mes();
    const anioOrig = this.anio();

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
          `¡Éxito! Se clonaron ${res.registros_clonados} movimientos a ${this.meses()[req.mes_destino - 1]} ${req.anio_destino}`,
        );
        this.isSubmittingClone.set(false);
        this.closeCloneModal();
        this.cloned.emit({ mes: req.mes_destino, anio: req.anio_destino });
      },
      error: (err) => {
        this.toastService.error(
          'Error al clonar el período: ' + getErrorMessage(err, err.message ?? 'error desconocido'),
        );
        this.isSubmittingClone.set(false);
        console.error(err);
      },
    });
  }
}
