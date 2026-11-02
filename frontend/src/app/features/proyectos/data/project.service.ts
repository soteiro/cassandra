import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { ProjectResponse, ProjectRequest, ProjectUpdateRequest } from './project.model';
import { Observable } from 'rxjs';
import { ServerConfigService } from '../../../core/server/server-config.service';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private readonly serverConfig = inject(ServerConfigService);
  // Getter: se lee en cada petición (en la app el servidor puede cambiar en caliente).
  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  readonly projectsResource = httpResource<ProjectResponse[]>(() => {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }
    return `${this.apiUrl}/proyects`;
  });

  public getProjectById(id: () => string | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<ProjectResponse>(() => {
      const projectId = id();
      if (!projectId) return undefined;
      return `${this.apiUrl}/proyects/${projectId}`;
    });
  }

  public getSubproyectos(id: () => string | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<ProjectResponse[]>(() => {
      const projectId = id();
      if (!projectId) return undefined;
      return `${this.apiUrl}/proyects/${projectId}/subproyectos`;
    });
  }

  createProject(req: ProjectRequest): Observable<ProjectResponse> {
    return this.http.post<ProjectResponse>(`${this.apiUrl}/proyects`, req);
  }

  updateProject(id: number, req: ProjectUpdateRequest): Observable<ProjectResponse> {
    return this.http.put<ProjectResponse>(`${this.apiUrl}/proyects/${id}`, req);
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/proyects/${id}`);
  }

  reload() {
    this.projectsResource.reload();
  }
}