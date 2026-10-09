import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ServerConfigService } from './server-config.service';
import { ToastService } from './toast.service';
import { Task } from '../models/task.model';
import { Preferencias } from '../models/revision.model';

/**
 * Límite de tareas En Curso: un aviso suave, nunca un bloqueo. Con menos cosas a la vez
 * cada una termina antes (ley de Little) y hay menos cambios de contexto.
 */
@Injectable({
  providedIn: 'root',
})
export class LimiteEnCursoService {
  private readonly http = inject(HttpClient);
  private readonly serverConfig = inject(ServerConfigService);
  private readonly toast = inject(ToastService);

  /** Cuenta las tareas En Curso y avisa si se pasó del límite guardado en la cuenta. */
  verificar(): void {
    const api = this.serverConfig.apiUrl();
    forkJoin({
      tareas: this.http.get<Task[]>(`${api}/tareas`, { params: { estado: 'En Curso' } }),
      pref: this.http.get<Preferencias>(`${api}/preferencias`),
    }).subscribe({
      next: ({ tareas, pref }) => {
        const n = tareas?.length ?? 0;
        if (n > pref.limite_en_curso) {
          this.toast.info(`Tienes ${n} tareas en curso y tu límite es ${pref.limite_en_curso}. ¿Cuál pausas?`);
        }
      },
      // Es solo un aviso: si falla, no molesta.
      error: () => {},
    });
  }
}
