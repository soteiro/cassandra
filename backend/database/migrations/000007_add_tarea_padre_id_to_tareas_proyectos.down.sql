-- Revertir la adición de la columna tarea_padre_id y sus restricciones
DROP INDEX IF EXISTS idx_tareas_proyectos_tarea_padre_id;

ALTER TABLE tareas_proyectos 
    DROP CONSTRAINT IF EXISTS fk_tareas_proyectos_padre;

ALTER TABLE tareas_proyectos 
    DROP COLUMN IF EXISTS tarea_padre_id;
