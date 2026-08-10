import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import { ProjectResponse, ProjectRequest, ProjectUpdateRequest } from '../models/proyect.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class proyectService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  readonly proyectResource = httpResource<ProjectResponse[]>(() => {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }
    return 'http://localhost:8080/api/proyects';
  });

  public getProyectById(id: () => string | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<ProjectResponse>(() => {
      const proyectId = id();
      if (!proyectId) return undefined;
      return `http://localhost:8080/api/proyects/${proyectId}`;
    });
  }

  createProyect(req: ProjectRequest): Observable<ProjectResponse> {
    return this.http.post<ProjectResponse>('http://localhost:8080/api/proyects', req);
  }

  updateProyect(id: number, req: ProjectUpdateRequest): Observable<ProjectResponse> {
    return this.http.put<ProjectResponse>(`http://localhost:8080/api/proyects/${id}`, req);
  }

  deleteProyect(id: number): Observable<void> {
    return this.http.delete<void>(`http://localhost:8080/api/proyects/${id}`);
  }

  reload() {
    this.proyectResource.reload();
  }
}