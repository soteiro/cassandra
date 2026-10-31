export type ReflexionTipo = 'reflexion' | 'evento' | 'memoria';

export interface Reflexion {
  id: number;
  user_id: number;
  reflexion: string;
  tipo: ReflexionTipo;
  fecha_creacion: string;
  fecha_actualizacion?: string;
  eliminado: boolean;
}

export interface ReflexionRequest {
  reflexion: string;
  tipo?: ReflexionTipo;
}

export interface ReflexionResponse {
  id: number;
  user_id: number;
  reflexion: string;
  tipo: ReflexionTipo;
  fecha_creacion: string;
  fecha_actualizacion?: string;
  eliminado: boolean;
}

export interface ReflexionUpdateRequest {
  reflexion?: string;
  tipo?: ReflexionTipo;
  eliminado?: boolean;
}
