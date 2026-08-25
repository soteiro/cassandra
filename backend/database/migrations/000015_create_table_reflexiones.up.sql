CREATE TABLE IF NOT EXISTS reflexiones (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    reflexion TEXT NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE,
    tipo VARCHAR(50) NOT NULL DEFAULT 'reflexion' CHECK (tipo IN ('reflexion', 'evento', 'memoria')),
    eliminado BOOL DEFAULT FALSE,

    -- relaciones
    CONSTRAINT fk_reflexiones_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reflexiones_user_id ON reflexiones(user_id);
CREATE INDEX IF NOT EXISTS idx_reflexiones_tipo ON reflexiones(tipo);
