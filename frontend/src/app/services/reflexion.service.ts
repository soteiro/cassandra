import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import {
  ReflexionRequest,
  ReflexionResponse,
  ReflexionUpdateRequest,
} from '../models/reflexion.model';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ReflexionService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  readonly reflexionesResource = httpResource<ReflexionResponse[]>(() => {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }
    return `${this.apiUrl}/reflexiones`;
  });

  public getReflexionesByTipo(tipo: () => string | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<ReflexionResponse[]>(() => {
      const tipoVal = tipo();
      if (!tipoVal || tipoVal === 'todas') {
        return `${this.apiUrl}/reflexiones`;
      }
      return `${this.apiUrl}/reflexiones?tipo=${encodeURIComponent(tipoVal)}`;
    });
  }

  public getReflexionById(id: () => string | number | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<ReflexionResponse>(() => {
      const refId = id();
      if (!refId) return undefined;
      return `${this.apiUrl}/reflexiones/${refId}`;
    });
  }

  createReflexion(req: ReflexionRequest): Observable<ReflexionResponse> {
    return this.http.post<ReflexionResponse>(`${this.apiUrl}/reflexiones`, req);
  }

  updateReflexion(
    id: number,
    req: ReflexionUpdateRequest
  ): Observable<ReflexionResponse> {
    return this.http.put<ReflexionResponse>(
      `${this.apiUrl}/reflexiones/${id}`,
      req
    );
  }

  deleteReflexion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/reflexiones/${id}`);
  }

  reload() {
    this.reflexionesResource.reload();
  }
}
