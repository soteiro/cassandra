-- Agregar columna prioridad a la tabla tareas_proyectos con valor por defecto 'normal'
ALTER TABLE tareas_proyectos 
    ADD COLUMN IF NOT EXISTS prioridad VARCHAR(20) NOT NULL DEFAULT 'normal';

-- Restricción para asegurar los valores permitidos: baja, normal, alta, urgente
ALTER TABLE tareas_proyectos 
    DROP CONSTRAINT IF EXISTS tareas_proyectos_prioridad_check;

ALTER TABLE tareas_proyectos 
    ADD CONSTRAINT tareas_proyectos_prioridad_check 
    CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente'));
