import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APIKey, CreateAPIKeyRequest, IssuedAPIKey } from '../models/api-key.model';
import { ServerConfigService } from './server-config.service';

@Injectable({ providedIn: 'root' })
export class APIKeyService {
  private readonly http = inject(HttpClient);
  private readonly serverConfig = inject(ServerConfigService);

  list() {
    return this.http.get<APIKey[]>(`${this.serverConfig.apiUrl()}/api-keys`);
  }

  create(request: CreateAPIKeyRequest) {
    return this.http.post<IssuedAPIKey>(`${this.serverConfig.apiUrl()}/api-keys`, request);
  }

  revoke(id: number) {
    return this.http.delete<void>(`${this.serverConfig.apiUrl()}/api-keys/${id}`);
  }
}
