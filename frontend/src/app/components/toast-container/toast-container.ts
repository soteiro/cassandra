import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { Toast, ToastType } from '../../models/toast.model';
import {
  LucideCircleCheck,
  LucideCircleX,
  LucideTriangleAlert,
  LucideInfo,
  LucideX,
} from '@lucide/angular';

@Component({
  selector: 'app-toast-container',
  imports: [
    CommonModule,
    LucideCircleCheck,
    LucideCircleX,
    LucideTriangleAlert,
    LucideInfo,
    LucideX,
  ],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.css',
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);
  protected readonly toasts = this.toastService.toasts;

  getToastCardClass(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'border-success/30 bg-surface/95 shadow-success/10';
      case 'error':
        return 'border-danger/30 bg-surface/95 shadow-danger/10';
      case 'warning':
        return 'border-amber-500/30 bg-surface/95 shadow-amber-500/10';
      case 'info':
      default:
        return 'border-accent/30 bg-surface/95 shadow-accent/10';
    }
  }

  getIconWrapperClass(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'text-success bg-success/15 border-success/30';
      case 'error':
        return 'text-danger bg-danger/15 border-danger/30';
      case 'warning':
        return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
      case 'info':
      default:
        return 'text-accent bg-accent/15 border-accent/30';
    }
  }

  getProgressBarClass(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'bg-success';
      case 'error':
        return 'bg-danger';
      case 'warning':
        return 'bg-amber-400';
      case 'info':
      default:
        return 'bg-accent';
    }
  }

  removeToast(id: string): void {
    this.toastService.remove(id);
  }

  handleAction(toast: Toast): void {
    if (toast.action) {
      toast.action.onClick();
      this.removeToast(toast.id);
    }
  }
}
