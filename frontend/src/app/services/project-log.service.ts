import { inject, Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { AuthService } from '../core/auth/auth.service';
import { ServerConfigService } from '../core/server/server-config.service';
import { ProjectLog } from '../models/project-log.model';

export const LOG_PAGE_SIZE = 30;

@Injectable({ providedIn: 'root' })
export class ProjectLogService {
  private readonly auth = inject(AuthService);
  private readonly server = inject(ServerConfigService);

  getByProyectoId(id: () => number, query: () => string, offset: () => number) {
    return httpResource<ProjectLog[]>(() => {
      const projectId = id();
      if (!this.auth.isLoggedIn() || !projectId) return undefined;
      return {
        url: `${this.server.apiUrl()}/proyects/${projectId}/logs`,
        params: { q: query().trim(), offset: offset(), limit: LOG_PAGE_SIZE + 1 },
      };
    });
  }
}
