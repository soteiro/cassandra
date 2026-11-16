export type TaskPrioridad = 'baja' | 'normal' | 'alta' | 'urgente';

export interface Task {
  id: number;
  nombre: string;
  descripcion: string;
  comentario: string;
  estado: string;
  prioridad: TaskPrioridad | string;
  eliminado: boolean;
  user_id: number;
  proyect_id: number;
  proyecto_nombre?: string;
  fecha_creacion: string;
  fecha_terminado?: string | null;
  fecha_actualizacion?: string;
  tarea_padre_id?: number | null;
  /** Medianoche UTC del día (ver diaAISO). */
  fecha_inicio?: string | null;
  fecha_limite?: string | null;
  /** Minutos estimados para terminarla. */
  estimacion_min?: number | null;
  subtareas?: Task[];
}

export interface TaskRequest {
  nombre: string;
  descripcion: string;
  comentario: string;
  estado?: string;
  prioridad?: TaskPrioridad | string;
  user_id?: number;
  proyect_id: number;
  tarea_padre_id?: number | null;
  fecha_inicio?: string;
  fecha_limite?: string;
  /** true quita la fecha al actualizar. */
  clear_fecha_inicio?: boolean;
  clear_fecha_limite?: boolean;
  estimacion_min?: number;
  clear_estimacion?: boolean;
}
