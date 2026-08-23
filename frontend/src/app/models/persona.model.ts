export interface Persona {
  id: number;
  user_id: number;
  nombre: string;
  alias?: string;
  entorno?: string;
  informacion?: string;
  fecha_creacion: string;
  eliminado: boolean;
}

export interface PersonaRequest {
  nombre: string;
  alias?: string;
  entorno?: string;
  informacion?: string;
  user_id?: number;
}

export interface PersonaResponse {
  id: number;
  user_id: number;
  nombre: string;
  alias?: string;
  entorno?: string;
  informacion?: string;
  fecha_creacion: string;
  eliminado: boolean;
}

export interface PersonaUpdateRequest {
  nombre?: string;
  alias?: string;
  entorno?: string;
  informacion?: string;
  eliminado?: boolean;
}
