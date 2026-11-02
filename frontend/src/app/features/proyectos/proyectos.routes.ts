import { Routes } from '@angular/router';

export const proyectosRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/proyectos/proyectos').then((m) => m.Proyectos),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/project-details/project-details').then((m) => m.ProjectDetails),
  },
];
