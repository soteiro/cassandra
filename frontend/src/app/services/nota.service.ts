import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import { NotaProyecto, NotaProyectoRequest, NotaProyectoUpdateRequest } from '../models/nota.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotaService {
  private readonly apiUrl = '/api';
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  public getNotasByProyectoId(proyectoId: () => string | number | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<NotaProyecto[]>(() => {
      const id = proyectoId();
      if (!id) return undefined;
      return `${this.apiUrl}/proyects/${id}/notas`;
    });
  }

  getNotaById(id: number): Observable<NotaProyecto> {
    return this.http.get<NotaProyecto>(`${this.apiUrl}/notas/${id}`);
  }

  createNota(proyectoId: number, req: NotaProyectoRequest): Observable<NotaProyecto> {
    return this.http.post<NotaProyecto>(`${this.apiUrl}/proyects/${proyectoId}/notas`, req);
  }

  updateNota(id: number, req: NotaProyectoUpdateRequest): Observable<NotaProyecto> {
    return this.http.put<NotaProyecto>(`${this.apiUrl}/notas/${id}`, req);
  }

  deleteNota(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/notas/${id}`);
  }
}
