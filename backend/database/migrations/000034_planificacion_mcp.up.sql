-- Planificación: el asistente (MCP) reparte tareas en los huecos libres del calendario.

-- Cuánto se estima que toma una tarea, en minutos (hasta una semana).
ALTER TABLE tareas_proyectos ADD COLUMN estimacion_min INTEGER
    CHECK (estimacion_min > 0 AND estimacion_min <= 10080);

-- Cómo cuenta cada calendario al calcular los huecos libres:
-- ocupa (terapias, citas), libera (colegio) o contexto (no cambia nada).
ALTER TABLE calendarios ADD COLUMN disponibilidad TEXT NOT NULL DEFAULT 'ocupa'
    CHECK (disponibilidad IN ('ocupa', 'libera', 'contexto'));
UPDATE calendarios SET disponibilidad = 'contexto' WHERE tipo = 'turnos';

-- Horario base del usuario: franjas en que puede trabajar, por día de la semana (0 = lunes).
CREATE TABLE horario_base (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL CHECK (hora_fin > hora_inicio),
    PRIMARY KEY (user_id, dia_semana, hora_inicio)
);

-- Bloques de trabajo: horas reservadas para una tarea en un día.
CREATE TABLE calendario_bloques (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tarea_id INTEGER NOT NULL REFERENCES tareas_proyectos(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL CHECK (hora_fin > hora_inicio),
    origen TEXT NOT NULL DEFAULT 'app' CHECK (origen IN ('app', 'mcp')),
    api_key_id BIGINT REFERENCES api_keys(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_calendario_bloques_user_fecha ON calendario_bloques (user_id, fecha);
CREATE INDEX idx_calendario_bloques_tarea ON calendario_bloques (tarea_id);

-- Idempotencia de las planificaciones hechas por integración.
CREATE TABLE planificacion_operaciones (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operacion_id VARCHAR(100) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    resultado JSONB NOT NULL,
    api_key_id BIGINT REFERENCES api_keys(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, operacion_id)
);

-- Permisos nuevos: leer el calendario y gestionar tareas (estado, fechas, bloques).
ALTER TABLE api_keys DROP CONSTRAINT api_keys_scopes_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_scopes_check
    CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['memory:read', 'memory:write', 'tasks:read', 'tasks:create', 'tasks:manage', 'calendar:read']::TEXT[]);

-- Calendarios cuyo contenido ve una key con calendar:read. Los demás solo cuentan
-- como ocupado, sin título.
CREATE TABLE api_key_calendarios (
    api_key_id BIGINT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    calendario_id INTEGER NOT NULL REFERENCES calendarios(id) ON DELETE CASCADE,
    PRIMARY KEY (api_key_id, calendario_id)
);
