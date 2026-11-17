import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ServerConfigService } from '../../../core/server/server-config.service';
import { HuecoLibre, PlanificacionResult, PlanificarRequest } from './planificacion.model';

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DDTHH:MM" en la hora local del navegador: los huecos empiezan ahí. */
export function ahoraLocal(d = new Date()): string {
  return (
    `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}` +
    `T${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
  );
}

/**
 * Reserva bloques de trabajo para una tarea con la sesión del usuario (el servidor los marca
 * con origen "app"). Usa los mismos endpoints que el asistente.
 */
@Injectable({ providedIn: 'root' })
export class PlanificacionService {
  private readonly http = inject(HttpClient);
  private readonly serverConfig = inject(ServerConfigService);

  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }

  planificar(
    proyectoId: number,
    tareaId: number,
    req: PlanificarRequest,
  ): Observable<PlanificacionResult> {
    return this.http.post<PlanificacionResult>(
      `${this.apiUrl}/integrations/projects/${proyectoId}/tasks/${tareaId}/bloques`,
      req,
    );
  }

  /** Huecos libres de un día; se vuelve a pedir al cambiar la fecha. */
  huecosResource(fecha: () => string) {
    return httpResource<{ huecos: HuecoLibre[] | null }>(() => {
      const dia = fecha();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return undefined;
      return {
        url: `${this.apiUrl}/integrations/calendar`,
        params: { desde: dia, hasta: dia, ahora: ahoraLocal() },
      };
    });
  }
}
