export interface NotaProyecto {
  id: number;
  proyecto_id: number;
  user_id: number;
  tarea_id?: number | null;
  tarea_nombre?: string;
  nota: string;
  fecha_creacion: string;
  eliminado: boolean;
}

export interface NotaProyectoRequest {
  proyecto_id?: number;
  tarea_id?: number | null;
  nota: string;
  user_id?: number;
}

export interface NotaProyectoResponse {
  id: number;
  proyecto_id: number;
  user_id: number;
  tarea_id?: number | null;
  tarea_nombre?: string;
  nota: string;
  fecha_creacion: string;
  eliminado: boolean;
}

export interface NotaProyectoUpdateRequest {
  nota?: string;
  tarea_id?: number | null;
  clear_tarea_id?: boolean;
  eliminado?: boolean;
}
