export type ProjectEstado =
  | 'Idea'
  | 'No Listado'
  | 'Pendiente'
  | 'En Proceso'
  | 'Pausado'
  | 'Completado'
  | 'Cancelado';

export type ProjectPrioridad = 'Baja' | 'Media' | 'Alta' | 'Critica';

export interface Project {
  id: number;
  nombre: string;
  descripcion: string;
  comentario: string;
  estado: ProjectEstado | string;
  por_que: string;
  para_que: string;
  criterio_finalizacion: string;
  prioridad: ProjectPrioridad | string;
  fecha_limite?: string;
  user_id: number;
  fecha_creacion: string;
  fecha_terminado?: string | null;
  proyecto_padre_id?: number | null;
  subproyectos_count?: number;
  nombre_padre?: string;
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
  proyecto_padre_id?: number | null;
}

export interface ProjectResponse {
  id: number;
  nombre: string;
  descripcion: string;
  comentario: string;
  fecha_creacion: string;
  fecha_terminado?: string | null;
  estado: string;
  por_que: string;
  para_que: string;
  criterio_finalizacion: string;
  prioridad: string;
  fecha_limite?: string;
  proyecto_padre_id?: number | null;
  subproyectos_count?: number;
  nombre_padre?: string;
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
  proyecto_padre_id?: number | null;
}

