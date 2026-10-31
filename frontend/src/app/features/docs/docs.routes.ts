import { Routes } from '@angular/router';

export const docsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/docs/docs').then((m) => m.Docs),
  },
];
