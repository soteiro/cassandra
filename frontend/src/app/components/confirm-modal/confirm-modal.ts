import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideTriangleAlert, LucideTrash2, LucideX } from '@lucide/angular';
import { BackButtonService } from '../../services/back-button.service';

@Component({
  selector: 'app-confirm-modal',
  imports: [CommonModule, LucideTriangleAlert, LucideTrash2, LucideX],
  templateUrl: './confirm-modal.html',
})
export class ConfirmModal {
  private readonly backButtonService = inject(BackButtonService);

  isOpen = input<boolean>(false);
  title = input<string>('¿Estás seguro?');
  message = input<string>('Esta acción no se puede deshacer.');
  confirmText = input<string>('Eliminar');
  cancelText = input<string>('Cancelar');
  variant = input<'danger' | 'warning' | 'info'>('danger');
  isProcessing = input<boolean>(false);

  confirm = output<void>();
  cancel = output<void>();

  private readonly _backBtnEffect = this.backButtonService.registerEffect(
    () => this.isOpen(),
    () => this.onCancel(),
    100
  );

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('backdrop-layer')) {
      this.onCancel();
    }
  }

  onConfirm() {
    this.confirm.emit();
  }

  onCancel() {
    this.cancel.emit();
  }
}
