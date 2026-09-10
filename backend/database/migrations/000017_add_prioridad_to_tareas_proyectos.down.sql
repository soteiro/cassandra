ALTER TABLE tareas_proyectos 
    DROP CONSTRAINT IF EXISTS tareas_proyectos_prioridad_check;

ALTER TABLE tareas_proyectos 
    DROP COLUMN IF EXISTS prioridad;
