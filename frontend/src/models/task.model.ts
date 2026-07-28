export interface Task {
  id: number;
  nombre: string;
  descripcion: string;
  comentario: string;
  estado: string;
  eliminado: boolean;
  user_id: number;
  proyect_id: number;
  fecha_creacion: string;
}

export interface TaskRequest {
  nombre: string;
  descripcion: string;
  comentario: string;
  estado?: string;
  user_id: number;
  proyect_id: number;
}
