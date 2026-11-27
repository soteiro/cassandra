import { provideAppInitializer, type EnvironmentProviders, type Provider } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { cargarApi, demoInterceptor } from './demo.interceptor';
import { montarAvisoDemo } from './demo-banner';

/** Build `demo`: la API se responde en el navegador y se muestra el aviso de demo. */
export const demoInterceptors: HttpInterceptorFn[] = [demoInterceptor];
export const demoProviders: (Provider | EnvironmentProviders)[] = [
  provideAppInitializer(() => {
    // Sin await: la API simulada baja en paralelo con las rutas, sin bloquear el arranque.
    void cargarApi();
    montarAvisoDemo();
  }),
];
