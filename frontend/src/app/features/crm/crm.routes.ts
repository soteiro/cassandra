import { Routes } from '@angular/router';

export const crmRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/crm/crm').then((m) => m.Crm),
  },
  {
    path: 'persona/:id',
    loadComponent: () =>
      import('./pages/persona-details/persona-details').then((m) => m.PersonaDetails),
  },
];
