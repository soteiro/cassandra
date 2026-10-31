import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/** Acceso a la plataforma nativa, aislado para poder reemplazarlo en tests. */
export interface AppPlatform {
  isNative(): boolean;
  /** versionName del APK instalado (p. ej. "0.2.1"). */
  getVersion(): Promise<string>;
}

export const APP_PLATFORM = new InjectionToken<AppPlatform>('APP_PLATFORM', {
  providedIn: 'root',
  factory: () => ({
    isNative: () => Capacitor.isNativePlatform(),
    getVersion: async () => (await App.getInfo()).version,
  }),
});
