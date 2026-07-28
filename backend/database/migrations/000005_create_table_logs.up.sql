CREATE TABLE IF NOT EXISTS project_logs (
    id SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL,
    user_id INT NOT NULL,
    titulo VARCHAR(150),
    contenido_raw TEXT NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    eliminado BOOL DEFAULT false,

    -- RELACIONES
    CONSTRAINT fk_project_logs_proyectos FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_logs_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_logs_proyecto_id ON project_logs(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_project_logs_user_id ON project_logs(user_id);
