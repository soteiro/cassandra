import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ServerConfigService } from './server-config.service';
import { TickTickConnection, TickTickToday } from '../models/ticktick.model';

@Injectable({ providedIn: 'root' })
export class TickTickService {
  private readonly http = inject(HttpClient);
  private readonly server = inject(ServerConfigService);

  status() {
    return this.http.get<TickTickConnection>(`${this.server.apiUrl()}/connections/ticktick`);
  }
  authorize() {
    return this.http.post<{ authorization_url: string }>(`${this.server.apiUrl()}/connections/ticktick/authorize`, {});
  }
  disconnect() {
    return this.http.delete<TickTickConnection>(`${this.server.apiUrl()}/connections/ticktick`);
  }
  today(date: string, zone: string, refresh = false) {
    const params = new HttpParams().set('date', date).set('time_zone', zone).set('refresh', refresh);
    return this.http.get<TickTickToday>(`${this.server.apiUrl()}/ticktick/tasks/today`, { params });
  }
}
