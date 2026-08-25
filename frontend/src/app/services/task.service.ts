import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Task, TaskRequest } from '../models/task.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly apiUrl = '/api';
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  
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
    return this.http.post<Task>(`${this.apiUrl}/tareas`, req);
  }

  updateTask(id: number, req: Partial<TaskRequest>): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/tareas/${id}`, req);
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tareas/${id}`);
  }
}
