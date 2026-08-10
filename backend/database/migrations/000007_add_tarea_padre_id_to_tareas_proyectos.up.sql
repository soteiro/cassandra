-- Agregar la columna tarea_padre_id a la tabla tareas_proyectos para soportar subtareas autoreferenciales
ALTER TABLE tareas_proyectos 
    ADD COLUMN IF NOT EXISTS tarea_padre_id INT NULL;

-- Agregar clave foránea referenciando a la misma tabla tareas_proyectos
ALTER TABLE tareas_proyectos 
    DROP CONSTRAINT IF EXISTS fk_tareas_proyectos_padre;

ALTER TABLE tareas_proyectos 
    ADD CONSTRAINT fk_tareas_proyectos_padre 
        FOREIGN KEY (tarea_padre_id) 
        REFERENCES tareas_proyectos(id) 
        ON DELETE CASCADE;

-- Crear índice para optimizar consultas de subtareas por tarea padre
CREATE INDEX IF NOT EXISTS idx_tareas_proyectos_tarea_padre_id ON tareas_proyectos(tarea_padre_id);
