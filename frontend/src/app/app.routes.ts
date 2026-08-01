
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [

        {
            path: '',
            redirectTo: 'login',
            pathMatch: 'full'
        },
        {
            path: 'login',
            loadComponent: () => import('./pages/login/login').then(m => m.Login)
        },
        {
            path: 'home',
            canActivate: [authGuard],
            loadComponent: () => import('./pages/home/home') .then(m => m.Home)
        },
        {                                                                                                                                                               
        path: '**',                                                                                                                                                   
        redirectTo: 'login'                                                                                                                                           
      }
];
