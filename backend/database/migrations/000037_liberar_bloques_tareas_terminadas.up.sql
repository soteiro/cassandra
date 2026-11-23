ALTER TABLE calendario_bloques ADD COLUMN liberado BOOLEAN NOT NULL DEFAULT false;

UPDATE calendario_bloques b SET liberado = true
FROM tareas_proyectos t
WHERE t.id = b.tarea_id AND t.estado IN ('Terminado', 'Completado');

CREATE FUNCTION liberar_bloques_tarea_terminada() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE calendario_bloques SET liberado = true
    WHERE tarea_id = NEW.id AND NOT liberado;
    RETURN NEW;
END;
$$;

CREATE TRIGGER liberar_bloques_tarea_terminada AFTER UPDATE OF estado ON tareas_proyectos
    FOR EACH ROW WHEN (OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado IN ('Terminado', 'Completado'))
    EXECUTE FUNCTION liberar_bloques_tarea_terminada();
