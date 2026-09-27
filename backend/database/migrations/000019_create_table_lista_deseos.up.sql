CREATE TABLE IF NOT EXISTS lista_deseos (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    presupuesto INT DEFAULT 0 NOT NULL,
    valor_estimado INT DEFAULT 0 NOT NULL,
    comprado BOOL DEFAULT FALSE NOT NULL,
    justificacion TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_compra TIMESTAMP WITH TIME ZONE,
    grupo_item_finanzas_id INT,
    eliminado BOOL DEFAULT FALSE NOT NULL,

    -- Claves foráneas (Foreign Keys)
    CONSTRAINT fk_lista_deseos_users 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,

    CONSTRAINT fk_lista_deseos_grupo_item 
        FOREIGN KEY (grupo_item_finanzas_id) 
        REFERENCES grupo_item_finanzas(id) 
        ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lista_deseos_user_id ON lista_deseos(user_id);
CREATE INDEX IF NOT EXISTS idx_lista_deseos_grupo_item ON lista_deseos(grupo_item_finanzas_id);
CREATE INDEX IF NOT EXISTS idx_lista_deseos_user_comprado ON lista_deseos(user_id, comprado) WHERE eliminado = FALSE;
