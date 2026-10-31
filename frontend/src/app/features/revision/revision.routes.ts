import { Routes } from '@angular/router';

export const revisionRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/revision/revision').then((m) => m.Revision),
  },
];
