import { InjectionToken } from '@angular/core';
import { registerPlugin } from '@capacitor/core';

export interface ApkDownloadStatus {
  status: 'idle' | 'downloading' | 'paused' | 'ready' | 'failed';
  progress?: number;
  error?: string;
}

export interface ApkUpdaterPlugin {
  startDownload(options: { url: string }): Promise<ApkDownloadStatus>;
  getDownloadStatus(): Promise<ApkDownloadStatus>;
  install(): Promise<{ permissionRequired: boolean }>;
}

const plugin = registerPlugin<ApkUpdaterPlugin>('ApkUpdater');

export const APK_UPDATER = new InjectionToken<ApkUpdaterPlugin>('APK_UPDATER', {
  providedIn: 'root',
  // No inyectar el Proxy de Capacitor: Angular consultaría sus hooks de ciclo de
  // vida (ngOnDestroy) como si fueran métodos nativos del plugin.
  factory: () => ({
    startDownload: options => plugin.startDownload(options),
    getDownloadStatus: () => plugin.getDownloadStatus(),
    install: () => plugin.install(),
  }),
});
