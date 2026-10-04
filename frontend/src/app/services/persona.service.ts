import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import { PersonaRequest, PersonaResponse, PersonaUpdateRequest } from '../models/persona.model';
import { Observable } from 'rxjs';
import { ServerConfigService } from './server-config.service';

@Injectable({
  providedIn: 'root',
})
export class PersonaService {
  private readonly serverConfig = inject(ServerConfigService);
  // Getter: se lee en cada petición (en la app el servidor puede cambiar en caliente).
  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  readonly personaResource = httpResource<PersonaResponse[]>(() => {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }
    return `${this.apiUrl}/personas`;
  });

  public getPersonaById(id: () => string | number | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<PersonaResponse>(() => {
      const personaId = id();
      if (!personaId) return undefined;
      return `${this.apiUrl}/personas/${personaId}`;
    });
  }

  createPersona(req: PersonaRequest): Observable<PersonaResponse> {
    return this.http.post<PersonaResponse>(`${this.apiUrl}/personas`, req);
  }

  updatePersona(id: number, req: PersonaUpdateRequest): Observable<PersonaResponse> {
    return this.http.put<PersonaResponse>(`${this.apiUrl}/personas/${id}`, req);
  }

  deletePersona(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/personas/${id}`);
  }

  reload() {
    this.personaResource.reload();
  }
}
