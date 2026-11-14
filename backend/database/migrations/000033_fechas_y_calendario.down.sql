DROP TABLE IF EXISTS calendario_cancelaciones;
DROP TABLE IF EXISTS calendario_actividades;
DROP TABLE IF EXISTS calendario_excepciones;
DROP TABLE IF EXISTS calendario_ciclos;
DROP TABLE IF EXISTS calendarios;

ALTER TABLE users DROP COLUMN IF EXISTS calendario_ocultar_deadlines;

ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS check_proyectos_fechas;
ALTER TABLE proyectos DROP COLUMN IF EXISTS fecha_inicio;

DROP INDEX IF EXISTS idx_tareas_fecha_limite;
ALTER TABLE tareas_proyectos DROP CONSTRAINT IF EXISTS check_tareas_fechas;
ALTER TABLE tareas_proyectos DROP COLUMN IF EXISTS fecha_limite;
ALTER TABLE tareas_proyectos DROP COLUMN IF EXISTS fecha_inicio;
