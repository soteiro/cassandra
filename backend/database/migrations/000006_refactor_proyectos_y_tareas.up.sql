-- 1. Agregar campos de justificacion y prioridad a la tabla proyectos
-- Se agrega con DEFAULT 'Sin especificar' primero para no romper filas existentes en la BD
ALTER TABLE proyectos 
    ADD COLUMN IF NOT EXISTS por_que TEXT NOT NULL DEFAULT 'Sin especificar',
    ADD COLUMN IF NOT EXISTS para_que TEXT NOT NULL DEFAULT 'Sin especificar',
    ADD COLUMN IF NOT EXISTS criterio_finalizacion TEXT NOT NULL DEFAULT 'Sin especificar',
    ADD COLUMN IF NOT EXISTS prioridad VARCHAR(20) NOT NULL DEFAULT 'Media',
    ADD COLUMN IF NOT EXISTS fecha_limite TIMESTAMP WITH TIME ZONE;

-- Remover el DEFAULT de las columnas obligatorias para que futuros INSERT requieran los datos explícitamente
ALTER TABLE proyectos 
    ALTER COLUMN por_que DROP DEFAULT,
    ALTER COLUMN para_que DROP DEFAULT,
    ALTER COLUMN criterio_finalizacion DROP DEFAULT,
    ALTER COLUMN prioridad DROP DEFAULT;

-- Actualizar/Añadir restricciones CHECK para estado y prioridad
ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS proyectos_estado_check;
ALTER TABLE proyectos ADD CONSTRAINT proyectos_estado_check 
    CHECK (estado IN ('Idea', 'No Listado', 'Pendiente', 'En Proceso', 'Pausado', 'Completado', 'Cancelado'));

ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS proyectos_prioridad_check;
ALTER TABLE proyectos ADD CONSTRAINT proyectos_prioridad_check 
    CHECK (prioridad IN ('Baja', 'Media', 'Alta', 'Critica'));

-- 2. Renombrar tabla tareas a tareas_proyectos y ajustar nombres de indices y constraints
ALTER TABLE IF EXISTS tareas RENAME TO tareas_proyectos;

ALTER INDEX IF EXISTS idx_tareas_proyecto_id RENAME TO idx_tareas_proyectos_proyecto_id;
ALTER INDEX IF EXISTS idx_tareas_users_id RENAME TO idx_tareas_proyectos_user_id;

ALTER TABLE tareas_proyectos RENAME CONSTRAINT fk_tareas_proyectos TO fk_tareas_proyectos_proyectos;
ALTER TABLE tareas_proyectos RENAME CONSTRAINT fk_tareas_users TO fk_tareas_proyectos_users;
