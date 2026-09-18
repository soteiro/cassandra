import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Banco,
  BancoRequest,
  ClonarPeriodoRequest,
  EstadoFinanzas,
  FinanzasPlantillaItem,
  FinanzasPlantillaRequest,
  FinanzasPlantillaUpdateRequest,
  FinanzasResumenPeriodo,
  GrupoItemFinanzas,
  GrupoItemFinanzasRequest,
  MovimientoEsperadoFinanzas,
  MovimientoEsperadoFinanzasRequest,
} from '../models/finanzas.model';

@Injectable({
  providedIn: 'root',
})
export class FinanzasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  // ==========================================
  // BANCOS
  // ==========================================
  getBancos(): Observable<Banco[]> {
    return this.http.get<Banco[]>(`${this.apiUrl}/finanzas/bancos`);
  }

  createBanco(req: BancoRequest): Observable<Banco> {
    return this.http.post<Banco>(`${this.apiUrl}/finanzas/bancos`, req);
  }

  updateBanco(id: number, req: Partial<BancoRequest>): Observable<Banco> {
    return this.http.put<Banco>(`${this.apiUrl}/finanzas/bancos/${id}`, req);
  }

  deleteBanco(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.apiUrl}/finanzas/bancos/${id}`);
  }

  // ==========================================
  // GRUPOS / CATEGORÍAS
  // ==========================================
  getGrupos(): Observable<GrupoItemFinanzas[]> {
    return this.http.get<GrupoItemFinanzas[]>(`${this.apiUrl}/finanzas/grupos`);
  }

  createGrupo(req: GrupoItemFinanzasRequest): Observable<GrupoItemFinanzas> {
    return this.http.post<GrupoItemFinanzas>(`${this.apiUrl}/finanzas/grupos`, req);
  }

  updateGrupo(id: number, req: Partial<GrupoItemFinanzasRequest>): Observable<GrupoItemFinanzas> {
    return this.http.put<GrupoItemFinanzas>(`${this.apiUrl}/finanzas/grupos/${id}`, req);
  }

  deleteGrupo(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.apiUrl}/finanzas/grupos/${id}`);
  }

  // ==========================================
  // MOVIMIENTOS ESPERADOS
  // ==========================================
  getMovimientosEsperados(): Observable<MovimientoEsperadoFinanzas[]> {
    return this.http.get<MovimientoEsperadoFinanzas[]>(`${this.apiUrl}/finanzas/movimientos-esperados`);
  }

  createMovimientoEsperado(req: MovimientoEsperadoFinanzasRequest): Observable<MovimientoEsperadoFinanzas> {
    return this.http.post<MovimientoEsperadoFinanzas>(`${this.apiUrl}/finanzas/movimientos-esperados`, req);
  }

  updateMovimientoEsperado(id: number, req: Partial<MovimientoEsperadoFinanzasRequest>): Observable<MovimientoEsperadoFinanzas> {
    return this.http.put<MovimientoEsperadoFinanzas>(`${this.apiUrl}/finanzas/movimientos-esperados/${id}`, req);
  }

  deleteMovimientoEsperado(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.apiUrl}/finanzas/movimientos-esperados/${id}`);
  }

  // ==========================================
  // PLANTILLA / MOVIMIENTOS MENSUALES
  // ==========================================
  getPlantilla(anio: number, mes: number): Observable<FinanzasPlantillaItem[]> {
    return this.http.get<FinanzasPlantillaItem[]>(`${this.apiUrl}/finanzas/plantilla`, {
      params: {
        anio: anio.toString(),
        mes: mes.toString(),
      },
    });
  }

  getPlantillaById(id: number): Observable<FinanzasPlantillaItem> {
    return this.http.get<FinanzasPlantillaItem>(`${this.apiUrl}/finanzas/plantilla/${id}`);
  }

  createPlantillaItem(req: FinanzasPlantillaRequest): Observable<FinanzasPlantillaItem> {
    return this.http.post<FinanzasPlantillaItem>(`${this.apiUrl}/finanzas/plantilla`, req);
  }

  updatePlantillaItem(id: number, req: FinanzasPlantillaUpdateRequest): Observable<FinanzasPlantillaItem> {
    return this.http.put<FinanzasPlantillaItem>(`${this.apiUrl}/finanzas/plantilla/${id}`, req);
  }

  deletePlantillaItem(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.apiUrl}/finanzas/plantilla/${id}`);
  }

  batchUpdateEstado(ids: number[], estado: EstadoFinanzas): Observable<FinanzasPlantillaItem[]> {
    if (!ids || ids.length === 0) return of([]);
    const calls = ids.map((id) => this.updatePlantillaItem(id, { estado }));
    return forkJoin(calls);
  }

  batchDelete(ids: number[]): Observable<{ mensaje: string }[]> {
    if (!ids || ids.length === 0) return of([]);
    const calls = ids.map((id) => this.deletePlantillaItem(id));
    return forkJoin(calls);
  }

  batchUpdateCategoria(ids: number[], grupoItemId: number | null): Observable<FinanzasPlantillaItem[]> {
    if (!ids || ids.length === 0) return of([]);
    const calls = ids.map((id) => this.updatePlantillaItem(id, { grupo_item_id: grupoItemId }));
    return forkJoin(calls);
  }

  batchUpdateBanco(ids: number[], bancoId: number | null): Observable<FinanzasPlantillaItem[]> {
    if (!ids || ids.length === 0) return of([]);
    const calls = ids.map((id) => this.updatePlantillaItem(id, { banco_id: bancoId }));
    return forkJoin(calls);
  }

  // ==========================================
  // RESUMEN Y CLONACIÓN
  // ==========================================
  getResumen(anio: number, mes: number): Observable<FinanzasResumenPeriodo> {
    return this.http.get<FinanzasResumenPeriodo>(`${this.apiUrl}/finanzas/resumen`, {
      params: {
        anio: anio.toString(),
        mes: mes.toString(),
      },
    });
  }

  clonarPeriodo(req: ClonarPeriodoRequest): Observable<{ mensaje: string; registros_clonados: number; mes_destino: number; anio_destino: number }> {
    return this.http.post<{ mensaje: string; registros_clonados: number; mes_destino: number; anio_destino: number }>(
      `${this.apiUrl}/finanzas/clonar`,
      req
    );
  }
}
