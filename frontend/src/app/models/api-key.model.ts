export type MemoryScope = 'memory:read' | 'memory:write';

export interface APIKey {
  id: number;
  nombre: string;
  prefijo: string;
  scopes: MemoryScope[];
  proyecto_ids: number[];
  fecha_creacion: string;
  expira_en: string | null;
  revocada_en: string | null;
  ultimo_uso: string | null;
}

export interface CreateAPIKeyRequest {
  nombre: string;
  scopes: MemoryScope[];
  proyecto_ids: number[];
  expira_en?: string;
}

export interface IssuedAPIKey extends APIKey {
  token: string;
}
