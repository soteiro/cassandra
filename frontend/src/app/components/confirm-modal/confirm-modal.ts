import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideTriangleAlert, LucideTrash2, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-confirm-modal',
  imports: [CommonModule, LucideTriangleAlert, LucideTrash2, LucideX],
  templateUrl: './confirm-modal.html',
})
export class ConfirmModal {
  isOpen = input<boolean>(false);
  title = input<string>('¿Estás seguro?');
  message = input<string>('Esta acción no se puede deshacer.');
  confirmText = input<string>('Eliminar');
  cancelText = input<string>('Cancelar');
  variant = input<'danger' | 'warning' | 'info'>('danger');
  isProcessing = input<boolean>(false);

  confirm = output<void>();
  cancel = output<void>();

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
