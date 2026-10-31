import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { authInterceptor } from './core/auth/auth.interceptor'
import { AuthService } from './core/auth/auth.service';
import { AppearanceService } from './shared/services/appearance.service';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    provideAppInitializer(() => { inject(AppearanceService); }),
    provideAppInitializer(() => {
      const authService = inject(AuthService);
      return authService.me();
    }),
   ],
};
