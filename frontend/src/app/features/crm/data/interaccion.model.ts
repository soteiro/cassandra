export interface Interaccion {
  id: number;
  user_id: number;
  persona_id: number;
  interaccion: string;
  fecha_creacion: string;
  fecha_actualizacion?: string | null;
  eliminado: boolean;
}

export interface InteraccionRequest {
  persona_id?: number;
  interaccion: string;
  user_id?: number;
}

export interface InteraccionResponse {
  id: number;
  user_id: number;
  persona_id: number;
  interaccion: string;
  fecha_creacion: string;
  fecha_actualizacion?: string | null;
  eliminado: boolean;
}

export interface InteraccionUpdateRequest {
  interaccion?: string;
  eliminado?: boolean;
}
