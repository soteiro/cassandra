import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import {
  InteraccionRequest,
  InteraccionResponse,
  InteraccionUpdateRequest,
} from '../models/interaccion.model';
import { Observable } from 'rxjs';
import { ServerConfigService } from './server-config.service';

@Injectable({
  providedIn: 'root',
})
export class InteraccionService {
  private readonly serverConfig = inject(ServerConfigService);
  // Getter: se lee en cada petición (en la app el servidor puede cambiar en caliente).
  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  public getInteraccionesByPersonaId(personaId: () => string | number | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<InteraccionResponse[]>(() => {
      const pId = personaId();
      if (!pId) return undefined;
      return `${this.apiUrl}/personas/${pId}/interacciones`;
    });
  }

  createInteraccion(
    personaId: number,
    req: { interaccion: string }
  ): Observable<InteraccionResponse> {
    return this.http.post<InteraccionResponse>(
      `${this.apiUrl}/personas/${personaId}/interacciones`,
      req
    );
  }

  updateInteraccion(
    id: number,
    req: InteraccionUpdateRequest
  ): Observable<InteraccionResponse> {
    return this.http.put<InteraccionResponse>(
      `${this.apiUrl}/interacciones/${id}`,
      req
    );
  }

  deleteInteraccion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/interacciones/${id}`);
  }
}
