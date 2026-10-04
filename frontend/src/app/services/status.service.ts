import { Injectable, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ServerConfigService } from './server-config.service';

export interface StatusResponse {
  status: string;
}

export interface Unique {
    response: string;
}

export interface DbTimeResponse {
    message: string;
    db_time: string;
}


export interface DbVersionResponse {
    message: string;
    status: string;
    version_db: string;
}
@Injectable({
  providedIn: 'root',
})
export class StatusService {
  private readonly serverConfig = inject(ServerConfigService);
  // Getter: se lee en cada petición (en la app el servidor puede cambiar en caliente).
  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }

  readonly health = httpResource<StatusResponse>(
    () => `${this.apiUrl}/health`,
  );

  readonly unique = httpResource<Unique>(
    () => `${this.apiUrl}/`,
  );

  readonly dbTime = httpResource<DbTimeResponse>(
    () => `${this.apiUrl}/db-time`,
  );

  readonly dbVersion = httpResource<DbVersionResponse>(
    () => `${this.apiUrl}/db-version`,
  );

  reload() { 
    this.health.reload();
    this.unique.reload();
    this.dbTime.reload();
    this.dbVersion.reload();
  }
}