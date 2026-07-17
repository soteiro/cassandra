CREATE TABLE IF NOT EXISTS tareas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    comentario TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    eliminado bool DEFAULT false,
    estado VARCHAR(50) DEFAULT 'Abierto' CHECK(estado in ('Abierto', 'Pendiente', 'En Curso', 'Terminado', 'Bloqueado')),
    user_id int NOT NULL,
    proyecto_id INT NOT NULL,

    --relaciones
    CONSTRAINT fk_tareas_proyectos FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    CONSTRAINT fk_tareas_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tareas_proyecto_id ON tareas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_tareas_users_id ON tareas(user_id);