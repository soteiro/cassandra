export interface Task {
  id: number;
  nombre: string;
  descripcion: string;
  comentario: string;
  estado: string;
  eliminado: boolean;
  user_id: number;
  proyect_id: number;
  proyecto_nombre?: string;
  fecha_creacion: string;
  fecha_terminado?: string | null;
  tarea_padre_id?: number | null;
  subtareas?: Task[];
}

export interface TaskRequest {
  nombre: string;
  descripcion: string;
  comentario: string;
  estado?: string;
  user_id?: number;
  proyect_id: number;
  tarea_padre_id?: number | null;
}
