import { effect, inject, Injectable, InjectionToken } from '@angular/core';
import { registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { AppearanceService } from '../../shared/services/appearance.service';
import { APP_PLATFORM } from './app-platform';

/** Plugin propio (AppWindowPlugin.java): pinta la ventana y las barras de Android. */
export interface AppWindowPlugin {
  setBackgroundColor(options: { color: string }): Promise<void>;
}

const appWindow = registerPlugin<AppWindowPlugin>('AppWindow');

export interface SystemBarsApi {
  setStyle(options: { style: SystemBarsStyle }): Promise<void>;
  setBackgroundColor(options: { color: string }): Promise<void>;
}

export const SYSTEM_BARS = new InjectionToken<SystemBarsApi>('SYSTEM_BARS', {
  providedIn: 'root',
  // Sin inyectar los Proxy de Capacitor: Angular consultaría ngOnDestroy como si fuera
  // un método nativo.
  factory: () => ({
    setStyle: (options) => SystemBars.setStyle(options),
    setBackgroundColor: (options) => appWindow.setBackgroundColor(options),
  }),
});

/** Ajusta las barras de Android (fondo e iconos) a la paleta y al modo de la apariencia. */
@Injectable({ providedIn: 'root' })
export class SystemBarsService {
  private readonly appearance = inject(AppearanceService);
  private readonly systemBars = inject(SYSTEM_BARS);

  constructor() {
    if (!inject(APP_PLATFORM).isNative()) return;
    effect(() => {
      // Dark = iconos claros, para fondos oscuros.
      const style =
        this.appearance.resolvedMode() === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light;
      this.systemBars.setStyle({ style }).catch(() => undefined);
    });
    effect(() => {
      const color = this.appearance.browserColor();
      if (color) this.systemBars.setBackgroundColor({ color }).catch(() => undefined);
    });
  }
}
