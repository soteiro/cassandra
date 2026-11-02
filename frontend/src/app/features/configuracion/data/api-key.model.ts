export type APIKeyScope = 'memory:read' | 'memory:write' | 'tasks:read' | 'tasks:create';

export interface APIKey {
  id: number;
  nombre: string;
  prefijo: string;
  scopes: APIKeyScope[];
  proyecto_ids: number[];
  fecha_creacion: string;
  expira_en: string | null;
  revocada_en: string | null;
  ultimo_uso: string | null;
}

export interface CreateAPIKeyRequest {
  nombre: string;
  scopes: APIKeyScope[];
  proyecto_ids: number[];
  expira_en?: string;
}

export interface IssuedAPIKey extends APIKey {
  token: string;
}
