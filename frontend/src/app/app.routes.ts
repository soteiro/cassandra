import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
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
        loadComponent: () => import('./pages/crm/crm').then((m)=> m.Crm)
      }
    ],
  },
  {
    path: '**',
    redirectTo: '/home',
  },
  
];
