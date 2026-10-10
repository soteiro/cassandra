export type DocumentoTipo =
  | 'arquitectura'
  | 'investigacion'
  | 'decision'
  | 'guia'
  | 'idea'
  | 'pajas mentales'
  | 'general'
  | 'retrospectiva';

export interface DocumentoProyecto {
  id: number;
  proyecto_id: number;
  user_id: number;
  titulo: string;
  contenido: string;
  tipo: DocumentoTipo;
  tags?: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  eliminado: boolean;
}

export interface CreateDocumentoRequest {
  proyecto_id?: number;
  titulo: string;
  contenido: string;
  tipo: DocumentoTipo;
  tags?: string;
}

export interface UpdateDocumentoRequest {
  titulo?: string;
  contenido?: string;
  tipo?: DocumentoTipo;
  tags?: string;
}
