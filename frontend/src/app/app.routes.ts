import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { serverConfiguredGuard } from './core/server/server-configured.guard';

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
      import('./core/layout/main-layout/main-layout').then((m) => m.MainLayout),
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
        loadChildren: () =>
          import('./features/finanzas/finanzas.routes').then((m) => m.finanzasRoutes),
      },
      {
        path: 'revision',
        loadChildren: () =>
          import('./features/revision/revision.routes').then((m) => m.revisionRoutes),
      },
      {
        path: 'configuracion/claves-api',
        loadComponent: () =>
          import('./pages/configuracion/api-keys-page').then((m) => m.ApiKeysPage),
      },
      {
        path: 'configuracion/ticktick',
        loadComponent: () => import('./pages/configuracion/ticktick-page').then((m) => m.TickTickPage),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./pages/configuracion/configuracion').then((m) => m.Configuracion),
      },
      {
        path: 'claves-api',
        redirectTo: 'configuracion/claves-api',
        pathMatch: 'full',
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
