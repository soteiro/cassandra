DROP INDEX IF EXISTS idx_notas_proyecto_tarea_id;
ALTER TABLE notas_proyecto DROP CONSTRAINT IF EXISTS fk_notas_proyecto_tareas;
ALTER TABLE notas_proyecto DROP COLUMN IF EXISTS tarea_id;
