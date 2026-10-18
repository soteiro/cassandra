ALTER TABLE documentos_proyecto ADD COLUMN gestionado BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE api_keys (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    prefijo VARCHAR(24) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    scopes TEXT[] NOT NULL CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['memory:read', 'memory:write']::TEXT[]),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en TIMESTAMPTZ,
    revocada_en TIMESTAMPTZ,
    ultimo_uso TIMESTAMPTZ
);
CREATE INDEX api_keys_usuario ON api_keys(user_id, id);

CREATE TABLE api_key_proyectos (
    api_key_id BIGINT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    PRIMARY KEY (api_key_id, proyecto_id)
);

CREATE TABLE memoria_proyectos (
    proyecto_id INTEGER PRIMARY KEY REFERENCES proyectos(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
    contenido JSONB,
    documento_id INTEGER REFERENCES documentos_proyecto(id) ON DELETE SET NULL,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE memoria_fichas (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titulo VARCHAR(160) NOT NULL,
    contenido TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('decision', 'exploracion')),
    estado TEXT NOT NULL CHECK (estado IN ('explorada', 'elegida', 'implementada', 'descartada', 'sustituida')),
    fuentes JSONB NOT NULL,
    sustituye_id BIGINT REFERENCES memoria_fichas(id),
    documento_id INTEGER REFERENCES documentos_proyecto(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX memoria_fichas_proyecto ON memoria_fichas(user_id, proyecto_id, id DESC);

CREATE TABLE memoria_operaciones (
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operacion_id VARCHAR(100) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    resultado JSONB NOT NULL,
    api_key_id BIGINT REFERENCES api_keys(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (proyecto_id, operacion_id)
);
