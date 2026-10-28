ALTER TABLE api_keys DROP CONSTRAINT api_keys_scopes_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_scopes_check
    CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['memory:read', 'memory:write', 'tasks:read', 'tasks:create']::TEXT[]);

CREATE TABLE tareas_operaciones (
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operacion_id VARCHAR(100) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    resultado JSONB NOT NULL,
    api_key_id BIGINT REFERENCES api_keys(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (proyecto_id, operacion_id)
);

CREATE INDEX idx_tareas_integracion_proyecto ON tareas_proyectos (user_id, proyecto_id, id DESC)
    WHERE eliminado = false;
