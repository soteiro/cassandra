export interface NotaProyecto {
  id: number;
  proyecto_id: number;
  user_id: number;
  nota: string;
  fecha_creacion: string;
  eliminado: boolean;
}

export interface NotaProyectoRequest {
  proyecto_id?: number;
  nota: string;
  user_id?: number;
}

export interface NotaProyectoResponse {
  id: number;
  proyecto_id: number;
  user_id: number;
  nota: string;
  fecha_creacion: string;
  eliminado: boolean;
}

export interface NotaProyectoUpdateRequest {
  nota?: string;
  eliminado?: boolean;
}
