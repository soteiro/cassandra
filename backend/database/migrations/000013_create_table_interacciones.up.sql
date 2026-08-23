CREATE TABLE IF NOT EXISTS interacciones (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    persona_id INT NOT NULL,
    interaccion TEXT NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE,
    eliminado BOOL DEFAULT FALSE,

    -- relaciones 
    CONSTRAINT fk_interacciones_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_interacciones_persona_id FOREIGN KEY (persona_id) REFERENCES persona(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interacciones_user_id ON interacciones(user_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_persona_id ON interacciones(persona_id);