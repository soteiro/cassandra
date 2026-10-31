import { Routes } from '@angular/router';

export const configuracionRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/configuracion/configuracion').then((m) => m.Configuracion),
  },
  {
    path: 'claves-api',
    loadComponent: () => import('./pages/api-keys-page/api-keys-page').then((m) => m.ApiKeysPage),
  },
  {
    path: 'ticktick',
    loadComponent: () =>
      import('../ticktick/pages/ticktick-page/ticktick-page').then((m) => m.TickTickPage),
  },
];
