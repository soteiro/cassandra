import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ServerConfigService } from './server-config.service';
import { Preferencias, ResumenRevision, Revision, TareaEstancada } from '../models/revision.model';

/** Revisión semanal: tareas estancadas, revisiones guardadas y preferencias. */
@Injectable({
  providedIn: 'root',
})
export class RevisionService {
  private readonly serverConfig = inject(ServerConfigService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  // Getter: se lee en cada petición (en la app el servidor puede cambiar en caliente).
  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }

  /** Compartidas: las usan la tarjeta del inicio, la página de revisión y el límite de tareas. */
  readonly preferenciasResource = httpResource<Preferencias>(() => {
    if (!this.authService.isLoggedIn()) return undefined;
    return `${this.apiUrl}/preferencias`;
  });

  readonly revisionesResource = httpResource<Revision[]>(() => {
    if (!this.authService.isLoggedIn()) return undefined;
    return { url: `${this.apiUrl}/revisiones`, params: { limit: 12 } };
  });

  getEstancadas(dias: () => number) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }
    return httpResource<TareaEstancada[]>(() => ({
      url: `${this.apiUrl}/revision/estancadas`,
      params: { dias: dias() },
    }));
  }

  crearRevision(nota: string, resumen: ResumenRevision): Observable<Revision> {
    return this.http.post<Revision>(`${this.apiUrl}/revisiones`, { nota, resumen });
  }

  actualizarPreferencias(cambios: Partial<Preferencias>): Observable<Preferencias> {
    return this.http.put<Preferencias>(`${this.apiUrl}/preferencias`, cambios);
  }
}
