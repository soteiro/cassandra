export interface Project {
  id: number;
  nombre: string;
  descripcion: string;
  comentario: string;
  estado: string;
  por_que: string;
  para_que: string;
  criterio_finalizacion: string;
  prioridad: string;
  fecha_limite?: string;
  user_id: number;
  fecha_creacion: string;
}

export interface ProjectRequest {
  nombre: string;
  descripcion: string;
  comentario: string;
  por_que: string;
  para_que: string;
  criterio_finalizacion: string;
  prioridad: string;
  fecha_limite?: string;
  user_id?: number;
}

export interface ProjectResponse {
  id: number;
  nombre: string;
  descripcion: string;
  comentario: string;
  fecha_creacion: string;
  estado: string;
  por_que: string;
  para_que: string;
  criterio_finalizacion: string;
  prioridad: string;
  fecha_limite?: string;
}

export interface ProjectUpdateRequest {
  nombre?: string;
  descripcion?: string;
  comentario?: string;
  estado?: string;
  por_que?: string;
  para_que?: string;
  criterio_finalizacion?: string;
  prioridad?: string;
  fecha_limite?: string;
}
