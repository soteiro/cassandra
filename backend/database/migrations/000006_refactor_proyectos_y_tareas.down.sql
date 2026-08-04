-- Revertir renaming de la tabla tareas_proyectos a tareas
ALTER TABLE IF EXISTS tareas_proyectos RENAME CONSTRAINT fk_tareas_proyectos_proyectos TO fk_tareas_proyectos;
ALTER TABLE IF EXISTS tareas_proyectos RENAME CONSTRAINT fk_tareas_proyectos_users TO fk_tareas_users;

ALTER INDEX IF EXISTS idx_tareas_proyectos_proyecto_id RENAME TO idx_tareas_proyecto_id;
ALTER INDEX IF EXISTS idx_tareas_proyectos_user_id RENAME TO idx_tareas_users_id;

ALTER TABLE IF EXISTS tareas_proyectos RENAME TO tareas;

-- Revertir restricciones y columnas agregadas en proyectos
ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS proyectos_prioridad_check;

ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS proyectos_estado_check;
ALTER TABLE proyectos ADD CONSTRAINT proyectos_estado_check 
    CHECK (estado IN ('No Listado', 'Pendiente', 'En Proceso', 'Completado'));

ALTER TABLE proyectos 
    DROP COLUMN IF EXISTS por_que,
    DROP COLUMN IF EXISTS para_que,
    DROP COLUMN IF EXISTS criterio_finalizacion,
    DROP COLUMN IF EXISTS prioridad,
    DROP COLUMN IF EXISTS fecha_limite;
