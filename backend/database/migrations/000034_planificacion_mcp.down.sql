DROP TABLE IF EXISTS api_key_calendarios;
-- Quitar los permisos nuevos; una key que solo tenía esos queda revocada.
UPDATE api_keys SET scopes = array_remove(array_remove(scopes, 'tasks:manage'), 'calendar:read');
UPDATE api_keys SET scopes = ARRAY['memory:read'], revocada_en = COALESCE(revocada_en, CURRENT_TIMESTAMP)
    WHERE cardinality(scopes) = 0;
ALTER TABLE api_keys DROP CONSTRAINT api_keys_scopes_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_scopes_check
    CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['memory:read', 'memory:write', 'tasks:read', 'tasks:create']::TEXT[]);
DROP TABLE IF EXISTS planificacion_operaciones;
DROP TABLE IF EXISTS calendario_bloques;
DROP TABLE IF EXISTS horario_base;
ALTER TABLE calendarios DROP COLUMN IF EXISTS disponibilidad;
ALTER TABLE tareas_proyectos DROP COLUMN IF EXISTS estimacion_min;
