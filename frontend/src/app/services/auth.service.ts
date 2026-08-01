import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { LoginRequest, MeResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  public readonly isLoggedIn = signal<Boolean>(false);

  public login(credentials: LoginRequest): Observable<any> {
    return this.http
      .post('http://localhost:8080/api/auth/login', credentials)
      .pipe(tap(() => this.isLoggedIn.set(true)));
  }

  public logout() {
    return this.http
      .post('http://localhost:8080/api/auth/logout', {})
      .pipe(tap(() => this.isLoggedIn.set(false)));
  }

  // Verifica si las cookies HttpOnly siguen validas contra el backend.
  // Emite true si la sesion es valida, false si no (401/expirado).
  // NUNCA propaga el error: el initializer de la app lo espera y
  // necesitamos que la app arranque igual aunque no haya sesion.
  public me(): Observable<boolean> {
    return this.http.get<MeResponse>('http://localhost:8080/api/auth/me').pipe(
      tap(() => this.isLoggedIn.set(true)),
      map(() => true),
      catchError(() => of(false)),
    );
  }
}
