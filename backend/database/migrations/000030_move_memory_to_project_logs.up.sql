ALTER TABLE project_logs
    ALTER COLUMN titulo TYPE VARCHAR(160),
    ADD COLUMN gestionado BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE project_logs SET fecha_actualizacion = COALESCE(fecha_creacion, CURRENT_TIMESTAMP);

ALTER TABLE memoria_proyectos ADD COLUMN log_id INTEGER REFERENCES project_logs(id) ON DELETE SET NULL;
ALTER TABLE memoria_fichas ADD COLUMN log_id INTEGER REFERENCES project_logs(id) ON DELETE SET NULL;

-- Conservar documentos originales y referencias antiguas para trazabilidad.
-- Solo se trasladan las copias gestionadas por memoria, nunca documentos manuales.
DO $$
DECLARE
    item RECORD;
    created_log_id INTEGER;
BEGIN
    PERFORM set_config('cassandra.origen', 'memory', true);
    FOR item IN
        SELECT 'memoria' AS clase, m.proyecto_id::BIGINT AS entidad_id, d.*
        FROM memoria_proyectos m
        JOIN documentos_proyecto d ON d.id=m.documento_id AND d.user_id=m.user_id AND d.proyecto_id=m.proyecto_id
        WHERE d.gestionado=true
        UNION ALL
        SELECT 'ficha' AS clase, f.id AS entidad_id, d.*
        FROM memoria_fichas f
        JOIN documentos_proyecto d ON d.id=f.documento_id AND d.user_id=f.user_id AND d.proyecto_id=f.proyecto_id
        WHERE d.gestionado=true
    LOOP
        INSERT INTO project_logs(proyecto_id,user_id,titulo,contenido_raw,fecha_creacion,fecha_actualizacion,eliminado,gestionado)
        VALUES(item.proyecto_id,item.user_id,item.titulo,item.contenido,item.fecha_creacion,item.fecha_actualizacion,item.eliminado,true)
        RETURNING id INTO created_log_id;
        IF item.clase='memoria' THEN
            UPDATE memoria_proyectos SET log_id=created_log_id WHERE proyecto_id=item.entidad_id;
        ELSE
            UPDATE memoria_fichas SET log_id=created_log_id WHERE id=item.entidad_id;
        END IF;
        UPDATE documentos_proyecto SET eliminado=true WHERE id=item.id;
    END LOOP;
END;
$$;

CREATE INDEX idx_project_logs_fecha ON project_logs(user_id,proyecto_id,fecha_creacion DESC,id DESC) WHERE eliminado=false;
