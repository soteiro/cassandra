export interface ProjectLog {
  id: number;
  proyecto_id: number;
  user_id: number;
  titulo: string;
  contenido_raw: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  eliminado: boolean;
  gestionado: boolean;
}
