import { Routes } from '@angular/router';

export const calendarioRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/calendario/calendario').then((m) => m.CalendarioPage),
  },
];
