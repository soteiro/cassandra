import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import { ProjectResponse, ProjectRequest, ProjectUpdateRequest } from '../models/proyect.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class proyectService {
  private readonly apiUrl = '/api';
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  readonly proyectResource = httpResource<ProjectResponse[]>(() => {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }
    return `${this.apiUrl}/proyects`;
  });

  public getProyectById(id: () => string | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<ProjectResponse>(() => {
      const proyectId = id();
      if (!proyectId) return undefined;
      return `${this.apiUrl}/proyects/${proyectId}`;
    });
  }

  createProyect(req: ProjectRequest): Observable<ProjectResponse> {
    return this.http.post<ProjectResponse>(`${this.apiUrl}/proyects`, req);
  }

  updateProyect(id: number, req: ProjectUpdateRequest): Observable<ProjectResponse> {
    return this.http.put<ProjectResponse>(`${this.apiUrl}/proyects/${id}`, req);
  }

  deleteProyect(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/proyects/${id}`);
  }

  reload() {
    this.proyectResource.reload();
  }
}