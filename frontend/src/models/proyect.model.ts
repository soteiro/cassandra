export interface Project {
  id: number;
  nombre: string;
  descripcion: string;
  comentario: string;
  estado: string;
  user_id: number;
  fecha_creacion: string;
}

export interface ProjectRequest {
  nombre: string;
  descripcion: string;
  comentario: string;
  user_id: number;
}
