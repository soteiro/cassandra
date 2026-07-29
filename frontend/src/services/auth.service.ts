import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, AuthResponse } from '../models/auth.model';
import { Login } from '../app/pages/login/login';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  public login(credentials: LoginRequest): Observable<any>{
    return this.http.post('http://localhost:8080/api/auth/login', credentials);
  }

  public logout() {
    return this.http.post('http://localhost:8080/api/auth/logout', {});
  }
}
