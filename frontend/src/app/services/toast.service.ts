import { Injectable, signal } from '@angular/core';
import { Toast, ToastOptions, ToastType } from '../models/toast.model';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  show(message: string, type: ToastType = 'info', options?: ToastOptions): string {
    const id = this.generateId();
    const duration = options?.duration !== undefined ? options.duration : 4000;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (duration > 0) {
      timeoutId = setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    const newToast: Toast = {
      id,
      message,
      type,
      title: options?.title,
      duration,
      action: options?.action,
      createdAt: Date.now(),
      timeoutId,
    };

    this._toasts.update((current) => [...current, newToast]);
    return id;
  }

  success(message: string, options?: ToastOptions): string {
    return this.show(message, 'success', options);
  }

  error(message: string, options?: ToastOptions): string {
    return this.show(message, 'error', options);
  }

  warning(message: string, options?: ToastOptions): string {
    return this.show(message, 'warning', options);
  }

  info(message: string, options?: ToastOptions): string {
    return this.show(message, 'info', options);
  }

  remove(id: string): void {
    const target = this._toasts().find((t) => t.id === id);
    if (target?.timeoutId) {
      clearTimeout(target.timeoutId);
    }
    this._toasts.update((current) => current.filter((t) => t.id !== id));
  }

  clear(): void {
    for (const toast of this._toasts()) {
      if (toast.timeoutId) {
        clearTimeout(toast.timeoutId);
      }
    }
    this._toasts.set([]);
  }
}
