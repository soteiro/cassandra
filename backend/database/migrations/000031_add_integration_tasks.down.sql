DROP INDEX idx_tareas_integracion_proyecto;
DROP TABLE tareas_operaciones;

ALTER TABLE api_keys DROP CONSTRAINT api_keys_scopes_check;
-- El rollback revoca las claves que tenían tareas, conservando sus metadatos.
-- Una clave que solo tenía tareas recibe un permiso de memoria de relleno,
-- siempre revocada, para cumplir el contrato anterior sin conceder acceso.
UPDATE api_keys SET
    revocada_en = COALESCE(revocada_en, CURRENT_TIMESTAMP),
    scopes = CASE WHEN scopes && ARRAY['memory:read', 'memory:write']::TEXT[]
        THEN ARRAY(SELECT scope FROM unnest(scopes) AS scope WHERE scope IN ('memory:read', 'memory:write'))
        ELSE ARRAY['memory:read']::TEXT[] END
    WHERE scopes && ARRAY['tasks:read', 'tasks:create']::TEXT[];
ALTER TABLE api_keys ADD CONSTRAINT api_keys_scopes_check
    CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['memory:read', 'memory:write']::TEXT[]);
