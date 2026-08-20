DROP INDEX IF EXISTS idx_proyectos_proyecto_padre_id;
ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS fk_proyectos_padre;
ALTER TABLE proyectos DROP COLUMN IF EXISTS proyecto_padre_id;
