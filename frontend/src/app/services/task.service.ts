import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Task, TaskRequest } from '../models/task.model';
import { Observable, tap } from 'rxjs';
import { ServerConfigService } from './server-config.service';
import { LimiteEnCursoService } from './limite-en-curso.service';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly serverConfig = inject(ServerConfigService);
  // Getter: se lee en cada petición (en la app el servidor puede cambiar en caliente).
  private get apiUrl(): string {
    return this.serverConfig.apiUrl();
  }
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly limiteEnCurso = inject(LimiteEnCursoService);
  
  public getTasksByProyectoId(proyectoId: () => string | number | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<Task[]>(() => {
      const id = proyectoId();
      if (!id) return undefined;
      return `${this.apiUrl}/proyects/${id}/tareas`;
    });
  }

  public getAllTasks(estado?: () => string | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<Task[]>(() => {
      const est = estado ? estado() : null;
      if (!est || est === 'all' || est === 'todas') {
        return `${this.apiUrl}/tareas`;
      }
      return `${this.apiUrl}/tareas?estado=${encodeURIComponent(est)}`;
    });
  }

  getTaskById(id: number): Observable<Task> {
    return this.http.get<Task>(`${this.apiUrl}/tareas/${id}`);
  }

  createTask(req: TaskRequest): Observable<Task> {
    return this.http.post<Task>(`${this.apiUrl}/tareas`, req).pipe(tap(() => this.avisarSiEnCurso(req.estado)));
  }

  updateTask(id: number, req: Partial<TaskRequest>): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/tareas/${id}`, req).pipe(tap(() => this.avisarSiEnCurso(req.estado)));
  }

  /** Al poner una tarea En Curso, aviso suave si te pasas del límite. */
  private avisarSiEnCurso(estado?: string | null) {
    if (estado === 'En Curso') this.limiteEnCurso.verificar();
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tareas/${id}`);
  }
}
