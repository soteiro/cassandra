import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ServerConfigService } from '../../../core/server/server-config.service';
import { Preferencias } from '../../../shared/models/preferencias.model';
import {
  Actividad,
  ActividadRequest,
  Calendario,
  CalendarioRango,
  CalendarioRequest,
  CodigoTurno,
  FranjaHorario,
} from './calendario.model';

export interface RangoParams {
  desde: string;
  hasta: string;
  /** Fecha local del cliente: decide qué deadlines están atrasados. */
  hoy: string;
}

/** Calendario: rango a dibujar y calendarios propios (turnos y actividades). */
@Injectable({
  providedIn: 'root',
})
export class CalendarioService {
  private readonly serverConfig = inject(ServerConfigService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  // Getter: se lee en cada petición (en la app el servidor puede cambiar en caliente).
  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }

  rango(params: () => RangoParams | null) {
    return httpResource<CalendarioRango>(() => {
      const p = params();
      if (!p || !this.authService.isLoggedIn()) return undefined;
      return { url: `${this.apiUrl}/calendario`, params: { ...p } };
    });
  }

  /** Calendarios propios (para elegir cuáles ve una clave). Solo pide mientras `activo`. */
  calendariosResource(activo: () => boolean) {
    return httpResource<Calendario[]>(() =>
      activo() && this.authService.isLoggedIn() ? `${this.apiUrl}/calendarios` : undefined,
    );
  }

  crearCalendario(req: CalendarioRequest): Observable<Calendario> {
    return this.http.post<Calendario>(`${this.apiUrl}/calendarios`, req);
  }

  actualizarCalendario(
    id: number,
    req: Partial<Pick<Calendario, 'nombre' | 'color' | 'oculto' | 'disponibilidad'>>,
  ): Observable<Calendario> {
    return this.http.put<Calendario>(`${this.apiUrl}/calendarios/${id}`, req);
  }

  eliminarCalendario(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/calendarios/${id}`);
  }

  fijarCiclo(id: number, primerLargo: string): Observable<Calendario> {
    return this.http.put<Calendario>(`${this.apiUrl}/calendarios/${id}/ciclo`, {
      primer_largo: primerLargo,
    });
  }

  marcarExcepcion(id: number, fecha: string, codigo: CodigoTurno): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/calendarios/${id}/excepciones/${fecha}`, { codigo });
  }

  quitarExcepcion(id: number, fecha: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/calendarios/${id}/excepciones/${fecha}`);
  }

  obtenerActividad(id: number): Observable<Actividad> {
    return this.http.get<Actividad>(`${this.apiUrl}/calendario/actividades/${id}`);
  }

  crearActividad(calendarioId: number, req: ActividadRequest): Observable<Actividad> {
    return this.http.post<Actividad>(`${this.apiUrl}/calendarios/${calendarioId}/actividades`, req);
  }

  actualizarActividad(id: number, req: ActividadRequest): Observable<Actividad> {
    return this.http.put<Actividad>(`${this.apiUrl}/calendario/actividades/${id}`, req);
  }

  eliminarActividad(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/calendario/actividades/${id}`);
  }

  /** Cancela (o restaura) una actividad solo ese día. */
  cancelarDia(actividadId: number, fecha: string, cancelar: boolean): Observable<void> {
    const url = `${this.apiUrl}/calendario/actividades/${actividadId}/cancelaciones/${fecha}`;
    return cancelar ? this.http.put<void>(url, null) : this.http.delete<void>(url);
  }

  horarioBase(): Observable<FranjaHorario[]> {
    return this.http.get<FranjaHorario[]>(`${this.apiUrl}/calendario/horario-base`);
  }

  /** Reemplaza todas las franjas. */
  guardarHorarioBase(franjas: FranjaHorario[]): Observable<FranjaHorario[]> {
    return this.http.put<FranjaHorario[]>(`${this.apiUrl}/calendario/horario-base`, { franjas });
  }

  quitarBloque(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/calendario/bloques/${id}`);
  }

  ocultarDeadlines(ocultar: boolean): Observable<Preferencias> {
    return this.http.put<Preferencias>(`${this.apiUrl}/preferencias`, {
      ocultar_deadlines: ocultar,
    });
  }
}
