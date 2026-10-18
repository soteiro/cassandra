-- Restaurar las copias gestionadas, incluidas las entradas creadas tras la migración.
DO $$
DECLARE
    item RECORD;
    restored_document_id INTEGER;
BEGIN
    PERFORM set_config('cassandra.origen', 'memory', true);
    FOR item IN
        SELECT 'memoria' AS clase, m.proyecto_id::BIGINT AS entidad_id, m.documento_id,
               'general' AS tipo_documento, l.*
        FROM memoria_proyectos m JOIN project_logs l ON l.id=m.log_id
        UNION ALL
        SELECT 'ficha' AS clase, f.id AS entidad_id, f.documento_id,
               CASE WHEN f.tipo='exploracion' THEN 'investigacion' ELSE 'decision' END AS tipo_documento, l.*
        FROM memoria_fichas f JOIN project_logs l ON l.id=f.log_id
    LOOP
        restored_document_id := NULL;
        UPDATE documentos_proyecto SET titulo=item.titulo,contenido=item.contenido_raw,
            eliminado=item.eliminado,fecha_actualizacion=item.fecha_actualizacion
        WHERE id=item.documento_id AND gestionado=true AND user_id=item.user_id AND proyecto_id=item.proyecto_id
        RETURNING id INTO restored_document_id;
        IF restored_document_id IS NULL THEN
            INSERT INTO documentos_proyecto(proyecto_id,user_id,titulo,contenido,tipo,tags,gestionado,eliminado,fecha_creacion,fecha_actualizacion)
            VALUES(item.proyecto_id,item.user_id,item.titulo,item.contenido_raw,item.tipo_documento,
                'memoria,gestionado-por-agente',true,item.eliminado,item.fecha_creacion,item.fecha_actualizacion)
            RETURNING id INTO restored_document_id;
        END IF;
        IF item.clase='memoria' THEN
            UPDATE memoria_proyectos SET documento_id=restored_document_id WHERE proyecto_id=item.entidad_id;
        ELSE
            UPDATE memoria_fichas SET documento_id=restored_document_id WHERE id=item.entidad_id;
        END IF;
        UPDATE project_logs SET eliminado=true WHERE id=item.id;
    END LOOP;
END;
$$;
DROP INDEX IF EXISTS idx_project_logs_fecha;
ALTER TABLE memoria_fichas DROP COLUMN log_id;
ALTER TABLE memoria_proyectos DROP COLUMN log_id;
ALTER TABLE project_logs DROP COLUMN fecha_actualizacion, DROP COLUMN gestionado;
-- Se mantiene VARCHAR(160) para no truncar títulos existentes.
