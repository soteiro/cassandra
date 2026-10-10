import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { serverConfiguredGuard } from './guards/server-configured.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'servidor',
    loadComponent: () => import('./pages/servidor/servidor').then((m) => m.Servidor),
  },
  {
    path: 'login',
    canActivate: [serverConfiguredGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [serverConfiguredGuard, authGuard],
    loadComponent: () =>
      import('./layouts/main-layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      { path: 'home', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
      {
        path: 'proyectos',
        loadComponent: () => import('./pages/proyectos/proyectos').then((m) => m.Proyectos),
      },
      {
        path: 'proyectos/:id',
        loadComponent: () =>
          import('./pages/proyect-details/proyect-details').then((m) => m.ProyectDetails),
      }, // ruta dinamica de proyectos
      {
        path: 'crm',
        loadComponent: () => import('./pages/crm/crm').then((m) => m.Crm),
      },
      {
        path: 'crm/persona/:id',
        loadComponent: () =>
          import('./pages/persona-details/persona-details').then((m) => m.PersonaDetails),
      },
      {
        path: 'persona/:id',
        redirectTo: 'crm/persona/:id',
      },
      {
        path: 'finanzas',
        loadComponent: () => import('./pages/finanzas/finanzas').then((m) => m.Finanzas),
      },
      {
        path: 'revision',
        loadComponent: () => import('./pages/revision/revision').then((m) => m.Revision),
      },
      {
        path: 'docs',
        loadComponent: () => import('./pages/docs/docs').then((m) => m.Docs),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/home',
  },
  
];
