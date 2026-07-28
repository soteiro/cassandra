import { Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';

export interface StatusResponse {
  status: string;
}

@Injectable({
  providedIn: 'root',
})
export class StatusService {
  readonly health = httpResource<StatusResponse>(
    () => 'http://localhost:8080/api/health',
  );

  reload() {
    this.health.reload();
  }
}