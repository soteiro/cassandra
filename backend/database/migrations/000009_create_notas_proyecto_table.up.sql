CREATE TABLE IF NOT EXISTS notas_proyecto (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    proyecto_id INT NOT NULL,
    nota_proyecto TEXT NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    eliminado BOOL DEFAULT FALSE,

    -- relaciones
    CONSTRAINT fk_notas_proyecto_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notas_proyecto_proyectos FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_notas_proyecto_user_id ON notas_proyecto(user_id);
CREATE INDEX IF NOT EXISTS idx_notas_proyecto_proyecto_id ON notas_proyecto(proyecto_id);