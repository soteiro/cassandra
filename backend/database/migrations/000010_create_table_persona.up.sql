   CREATE TABLE IF NOT EXISTS persona (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        alias VARCHAR(100),
        entorno VARCHAR(200),
        informacion TEXT,
        fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        eliminado BOOL DEFAULT false,

        -- Relaciones
        CONSTRAINT fk_persona_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Índice para mejorar el rendimiento en búsquedas por usuario
    CREATE INDEX IF NOT EXISTS idx_persona_user_id ON persona(user_id);