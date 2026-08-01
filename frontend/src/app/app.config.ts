import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { credentialsInterceptor } from '../app/interceptors/credentials.interceptor'
import { AuthService } from './services/auth.service';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([credentialsInterceptor])
    ),
    provideAppInitializer(() => {
      // Antes de resolver la primera ruta, preguntamos al backend
      // si las cookies HttpOnly siguen siendo validas.
      // Si lo son, AuthService pone isLoggedIn en true y el guard deja pasar a /home.
      const authService = inject(AuthService);
      return authService.me();
    }),
   ],
};
