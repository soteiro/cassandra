import { inject, Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import { ServerConfigService } from './server-config.service';
import { EventoActividad, ResumenActividad } from '../models/actividad.model';

/** "Lo que hiciste" (resumen por periodo) y "En qué quedaste" (actividad por proyecto). */
@Injectable({
  providedIn: 'root',
})
export class ActividadService {
  private readonly serverConfig = inject(ServerConfigService);
  private readonly authService = inject(AuthService);
  // Getter: se lee en cada petición (en la app el servidor puede cambiar en caliente).
  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }

  /** Resumen de [desde, hasta). Los límites se calculan en la hora local del usuario. */
  getResumen(periodo: () => { desde: Date; hasta: Date } | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }
    return httpResource<ResumenActividad>(() => {
      const p = periodo();
      if (!p) return undefined;
      return {
        url: `${this.apiUrl}/actividad/resumen`,
        params: { desde: p.desde.toISOString(), hasta: p.hasta.toISOString() },
      };
    });
  }

  getActividadProyecto(id: () => string | number | null, limit: () => number) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }
    return httpResource<EventoActividad[]>(() => {
      const proyectoId = id();
      if (!proyectoId) return undefined;
      return { url: `${this.apiUrl}/proyects/${proyectoId}/actividad`, params: { limit: limit() } };
    });
  }
}
