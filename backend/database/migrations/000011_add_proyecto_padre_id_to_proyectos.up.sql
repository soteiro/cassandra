-- Agregar la columna proyecto_padre_id a la tabla proyectos para soportar proyectos hijos/subproyectos
ALTER TABLE proyectos 
    ADD COLUMN IF NOT EXISTS proyecto_padre_id INT NULL;

-- Clave foránea autoreferencial con ON DELETE CASCADE
ALTER TABLE proyectos 
    DROP CONSTRAINT IF EXISTS fk_proyectos_padre;

ALTER TABLE proyectos 
    ADD CONSTRAINT fk_proyectos_padre 
        FOREIGN KEY (proyecto_padre_id) 
        REFERENCES proyectos(id) 
        ON DELETE CASCADE;

-- Índice para optimizar consultas de subproyectos por proyecto padre
CREATE INDEX IF NOT EXISTS idx_proyectos_proyecto_padre_id ON proyectos(proyecto_padre_id);
