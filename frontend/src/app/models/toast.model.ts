export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title?: string;
  duration?: number; // In milliseconds. Default: 4000ms. Set to 0 for persistent toasts.
  action?: ToastAction;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  duration: number;
  action?: ToastAction;
  createdAt: number;
  timeoutId?: ReturnType<typeof setTimeout>;
}
