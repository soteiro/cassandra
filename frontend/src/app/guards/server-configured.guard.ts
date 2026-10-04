import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ServerConfigService } from '../services/server-config.service';

/** En la app Android, sin servidor configurado se va primero a /servidor. */
export const serverConfiguredGuard: CanActivateFn = () => {
  if (inject(ServerConfigService).isConfigured()) {
    return true;
  }
  return inject(Router).createUrlTree(['/servidor']);
};
