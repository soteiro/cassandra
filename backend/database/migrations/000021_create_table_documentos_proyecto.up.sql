CREATE TABLE IF NOT EXISTS documentos_proyecto (
    id SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL,
    user_id INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'general',
    tags VARCHAR(255),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    eliminado BOOL NOT NULL DEFAULT false,

    -- Claves foráneas
    CONSTRAINT fk_documentos_proyecto_proyectos FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    CONSTRAINT fk_documentos_proyecto_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- Restricción de tipos de documento
    CONSTRAINT check_documentos_proyecto_tipo CHECK (tipo IN ('arquitectura', 'investigacion', 'decision', 'guia', 'idea', 'pajas mentales', 'general'))
);

CREATE INDEX IF NOT EXISTS idx_documentos_proyecto_proyecto_id ON documentos_proyecto(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_proyecto_user_id ON documentos_proyecto(user_id);
CREATE INDEX IF NOT EXISTS idx_documentos_proyecto_tipo ON documentos_proyecto(tipo);
