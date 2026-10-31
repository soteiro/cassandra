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
    loadComponent: () => import('./features/auth/pages/servidor/servidor').then((m) => m.Servidor),
  },
  {
    path: 'login',
    canActivate: [serverConfiguredGuard],
    loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [serverConfiguredGuard, authGuard],
    loadComponent: () =>
      import('./core/layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      {
        path: 'home',
        loadChildren: () => import('./features/home/home.routes').then((m) => m.homeRoutes),
      },
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
        loadChildren: () => import('./features/crm/crm.routes').then((m) => m.crmRoutes),
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
        path: 'configuracion',
        loadChildren: () =>
          import('./features/configuracion/configuracion.routes').then(
            (m) => m.configuracionRoutes,
          ),
      },
      {
        path: 'claves-api',
        redirectTo: 'configuracion/claves-api',
        pathMatch: 'full',
      },
      {
        path: 'docs',
        loadChildren: () => import('./features/docs/docs.routes').then((m) => m.docsRoutes),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/home',
  },
  
];
