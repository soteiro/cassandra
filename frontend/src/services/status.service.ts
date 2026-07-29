import { Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Timestamp } from 'rxjs';

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
  readonly health = httpResource<StatusResponse>(
    () => 'http://localhost:8080/api/health',
  );

  readonly unique = httpResource<Unique>(
    () => 'http://localhost:8080/api/'
  )

  readonly dbTime = httpResource<DbTimeResponse> (
    () => 'http://localhost:8080/api/db-time'
  )
  readonly dbVersion = httpResource<DbVersionResponse>(
    ()=> 'http://localhost:8080/api/db-version'
  )
  reload() { 
    this.health.reload();
    this.unique.reload();
    this.dbTime.reload();
    this.dbVersion.reload();
  }
}