-- Reconstruye la historia previa al registro de eventos a partir de las fechas que ya
-- existen. Es aproximada: no se sabe el estado anterior de cada cambio, así que solo se
-- guarda "despues", y todo queda con origen 'backfill'. Solo filas no eliminadas (no se
-- sabe cuándo se borraron).

-- 1. Creación de cada registro.
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT * FROM (VALUES
            ('proyectos', 'proyecto', 'id'),
            ('tareas_proyectos', 'tarea', 'proyecto_id'),
            ('notas_proyecto', 'nota', 'proyecto_id'),
            ('documentos_proyecto', 'documento', 'proyecto_id'),
            ('project_logs', 'log', 'proyecto_id'),
            ('persona', 'persona', 'NULL::int'),
            ('interacciones', 'interaccion', 'NULL::int'),
            ('reflexiones', 'reflexion', 'NULL::int'),
            ('lista_deseos', 'deseo', 'NULL::int'),
            ('banco', 'banco', 'NULL::int'),
            ('grupo_item_finanzas', 'grupo_finanzas', 'NULL::int'),
            ('movimiento_esperado_finanzas', 'movimiento_esperado', 'NULL::int'),
            ('finanzas_plantilla', 'plantilla_finanzas', 'NULL::int')
        ) AS v (tabla, entidad, proyecto)
    LOOP
        EXECUTE format(
            'INSERT INTO eventos (user_id, entidad, entidad_id, proyecto_id, accion, cambios, origen, ocurrido_en)
             SELECT user_id, %L, id, %s, ''creado'', ''{}'', ''backfill'', fecha_creacion
             FROM %I
             WHERE eliminado IS NOT TRUE AND fecha_creacion IS NOT NULL',
            t.entidad, t.proyecto, t.tabla);
    END LOOP;
END;
$$;

-- 2. Tareas y proyectos terminados (fecha_terminado solo existe mientras siguen así).
INSERT INTO eventos (user_id, entidad, entidad_id, proyecto_id, accion, cambios, origen, ocurrido_en)
SELECT user_id, 'tarea', id, proyecto_id, 'modificado',
       jsonb_build_object('estado', jsonb_build_object('despues', estado)),
       'backfill', fecha_terminado
FROM tareas_proyectos
WHERE eliminado IS NOT TRUE AND fecha_terminado IS NOT NULL;

INSERT INTO eventos (user_id, entidad, entidad_id, proyecto_id, accion, cambios, origen, ocurrido_en)
SELECT user_id, 'proyecto', id, id, 'modificado',
       jsonb_build_object('estado', jsonb_build_object('despues', estado)),
       'backfill', fecha_terminado
FROM proyectos
WHERE eliminado IS NOT TRUE AND fecha_terminado IS NOT NULL;

-- 3. Deseos comprados.
INSERT INTO eventos (user_id, entidad, entidad_id, proyecto_id, accion, cambios, origen, ocurrido_en)
SELECT user_id, 'deseo', id, NULL, 'modificado',
       jsonb_build_object('comprado', jsonb_build_object('despues', true)),
       'backfill', fecha_compra
FROM lista_deseos
WHERE eliminado IS NOT TRUE AND comprado AND fecha_compra IS NOT NULL;

-- 4. Última edición de documentos, interacciones y reflexiones (no se sabe qué cambió).
INSERT INTO eventos (user_id, entidad, entidad_id, proyecto_id, accion, cambios, origen, ocurrido_en)
SELECT user_id, 'documento', id, proyecto_id, 'modificado', '{}', 'backfill', fecha_actualizacion
FROM documentos_proyecto
WHERE eliminado IS NOT TRUE AND fecha_actualizacion > fecha_creacion + INTERVAL '1 second';

INSERT INTO eventos (user_id, entidad, entidad_id, proyecto_id, accion, cambios, origen, ocurrido_en)
SELECT user_id, 'interaccion', id, NULL, 'modificado', '{}', 'backfill', fecha_actualizacion
FROM interacciones
WHERE eliminado IS NOT TRUE AND fecha_actualizacion > fecha_creacion + INTERVAL '1 second';

INSERT INTO eventos (user_id, entidad, entidad_id, proyecto_id, accion, cambios, origen, ocurrido_en)
SELECT user_id, 'reflexion', id, NULL, 'modificado', '{}', 'backfill', fecha_actualizacion
FROM reflexiones
WHERE eliminado IS NOT TRUE AND fecha_actualizacion > fecha_creacion + INTERVAL '1 second';
