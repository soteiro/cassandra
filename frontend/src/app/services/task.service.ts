import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Task, TaskRequest } from '../models/task.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  public getTasksByProyectoId(proyectoId: () => string | number | null) {
    if (!this.authService.isLoggedIn()) {
      return undefined;
    }

    return httpResource<Task[]>(() => {
      const id = proyectoId();
      if (!id) return undefined;
      return `http://localhost:8080/api/proyects/${id}/tareas`;
    });
  }

  getTaskById(id: number): Observable<Task> {
    return this.http.get<Task>(`http://localhost:8080/api/tareas/${id}`);
  }

  createTask(req: TaskRequest): Observable<Task> {
    return this.http.post<Task>('http://localhost:8080/api/tareas', req);
  }

  updateTask(id: number, req: Partial<TaskRequest>): Observable<Task> {
    return this.http.put<Task>(`http://localhost:8080/api/tareas/${id}`, req);
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`http://localhost:8080/api/tareas/${id}`);
  }
}
