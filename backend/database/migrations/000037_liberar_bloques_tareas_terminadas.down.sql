DROP TRIGGER liberar_bloques_tarea_terminada ON tareas_proyectos;
DROP FUNCTION liberar_bloques_tarea_terminada();
ALTER TABLE calendario_bloques DROP COLUMN liberado;
