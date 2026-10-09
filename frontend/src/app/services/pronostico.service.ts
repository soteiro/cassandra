import { inject, Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import { ServerConfigService } from './server-config.service';
import { Planificacion, PronosticoProyecto } from '../models/pronostico.model';

/** Pronósticos: cuánto te demoras de verdad y cuándo terminaría un proyecto. */
@Injectable({
  providedIn: 'root',
})
export class PronosticoService {
  private readonly serverConfig = inject(ServerConfigService);
  private readonly authService = inject(AuthService);
  // Getter: se lee en cada petición (en la app el servidor puede cambiar en caliente).
  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }

  /** Compartido: lo usa el modal de proyecto al elegir una fecha límite. */
  readonly planificacionResource = httpResource<Planificacion>(() => {
    if (!this.authService.isLoggedIn()) return undefined;
    return `${this.apiUrl}/pronosticos/planificacion`;
  });

  getPronosticoProyecto(id: () => string | number | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }
    return httpResource<PronosticoProyecto>(() => {
      const proyectoId = id();
      if (!proyectoId) return undefined;
      return `${this.apiUrl}/proyects/${proyectoId}/pronostico`;
    });
  }
}
