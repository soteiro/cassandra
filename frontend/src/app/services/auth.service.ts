import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { LoginRequest, MeResponse } from '../models/auth.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);
  public readonly isLoggedIn = signal<boolean>(false);

  public login(credentials: LoginRequest): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/auth/login`, credentials)
      .pipe(tap(() => this.isLoggedIn.set(true)));
  }

  public logout(): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/auth/logout`, {})
      .pipe(tap(() => this.isLoggedIn.set(false)));
  }

  // Verifica si las cookies HttpOnly siguen validas contra el backend.
  // Emite true si la sesion es valida, false si no (401/expirado).
  // NUNCA propaga el error: el initializer de la app lo espera y
  // necesitamos que la app arranque igual aunque no haya sesion.
  public me(): Observable<boolean> {
    return this.http.get<MeResponse>(`${this.apiUrl}/auth/me`).pipe(
      tap(() => this.isLoggedIn.set(true)),
      map(() => true),
      catchError(() => of(false)),
    );
  }

  // Renueva el access_token usando el refresh_token de la cookie HttpOnly.
  // El backend setea la nueva cookie access_token en la respuesta.
  // Los errores los maneja el interceptor (no aqui) para decidir logout.
  public refresh(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/refresh`, {});
  }
}
