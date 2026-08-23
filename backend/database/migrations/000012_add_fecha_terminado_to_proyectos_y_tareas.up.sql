-- Agregar columna fecha_terminado a tareas_proyectos
ALTER TABLE tareas_proyectos 
    ADD COLUMN IF NOT EXISTS fecha_terminado TIMESTAMP WITH TIME ZONE NULL;

-- Agregar columna fecha_terminado a proyectos
ALTER TABLE proyectos 
    ADD COLUMN IF NOT EXISTS fecha_terminado TIMESTAMP WITH TIME ZONE NULL;
