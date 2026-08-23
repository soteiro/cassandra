import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import {
  InteraccionRequest,
  InteraccionResponse,
  InteraccionUpdateRequest,
} from '../models/interaccion.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InteraccionService {
  private readonly apiUrl = '/api';
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
