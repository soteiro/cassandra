CREATE TABLE IF NOT EXISTS proyectos (
    id SERIAL  PRIMARY KEY,
    user_id INT NOT NULL,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    comentario TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'No Listado' CHECK (estado IN ('No Listado', 'Pendiente', 'En Proceso', 'Completado')),
    eliminado BOOL DEFAULT false,

    -- RELACIONES
    CONSTRAINT fk_proyectos_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- crear indice
CREATE INDEX IF NOT EXISTS idx_proyectos_user_id ON proyectos(user_id);