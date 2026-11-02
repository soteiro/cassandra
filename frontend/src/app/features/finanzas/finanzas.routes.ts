import { Routes } from '@angular/router';

export const finanzasRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/finanzas/finanzas').then((m) => m.Finanzas),
  },
];
