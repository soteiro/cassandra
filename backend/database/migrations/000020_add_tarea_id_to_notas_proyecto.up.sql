-- Agregar la columna tarea_id a la tabla notas_proyecto para permitir vincular notas/soluciones a tareas específicas
ALTER TABLE notas_proyecto 
    ADD COLUMN IF NOT EXISTS tarea_id INT NULL;

-- Clave foránea con ON DELETE SET NULL para que si se borra la tarea, la nota de bitácora no se pierda
ALTER TABLE notas_proyecto 
    DROP CONSTRAINT IF EXISTS fk_notas_proyecto_tareas;

ALTER TABLE notas_proyecto 
    ADD CONSTRAINT fk_notas_proyecto_tareas 
    FOREIGN KEY (tarea_id) 
    REFERENCES tareas_proyectos(id) 
    ON DELETE SET NULL;

-- Índice para optimizar consultas de notas por tarea
CREATE INDEX IF NOT EXISTS idx_notas_proyecto_tarea_id ON notas_proyecto(tarea_id);
