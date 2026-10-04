import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import {
  DocumentoProyecto,
  CreateDocumentoRequest,
  UpdateDocumentoRequest,
} from '../models/documento.model';
import { ServerConfigService } from './server-config.service';

@Injectable({
  providedIn: 'root',
})
export class DocumentoService {
  private readonly serverConfig = inject(ServerConfigService);
  // Getter: se lee en cada petición (en la app el servidor puede cambiar en caliente).
  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  public getDocumentosByProyectoId(
    proyectoId: () => string | number | null,
    tipoFilter?: () => string | null
  ) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<DocumentoProyecto[]>(() => {
      const id = proyectoId();
      if (!id) return undefined;
      const tipo = tipoFilter ? tipoFilter() : null;
      if (tipo && tipo !== 'todas' && tipo !== 'todos') {
        return `${this.apiUrl}/proyects/${id}/documentos?tipo=${encodeURIComponent(tipo)}`;
      }
      return `${this.apiUrl}/proyects/${id}/documentos`;
    });
  }

  getDocumentoById(id: number): Observable<DocumentoProyecto> {
    return this.http.get<DocumentoProyecto>(`${this.apiUrl}/documentos/${id}`);
  }

  createDocumento(proyectoId: number, req: CreateDocumentoRequest): Observable<DocumentoProyecto> {
    return this.http.post<DocumentoProyecto>(`${this.apiUrl}/proyects/${proyectoId}/documentos`, req);
  }

  updateDocumento(id: number, req: UpdateDocumentoRequest): Observable<DocumentoProyecto> {
    return this.http.put<DocumentoProyecto>(`${this.apiUrl}/documentos/${id}`, req);
  }

  deleteDocumento(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/documentos/${id}`);
  }
}
