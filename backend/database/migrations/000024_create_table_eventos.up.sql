-- Registro de eventos: qué cambió, cuándo y desde dónde, para ver flujos y no solo el
-- estado actual. Lo escriben triggers, así que cubre la API, el CLI, el seed y lo que
-- venga (chat, MCP) sin que cada repositorio tenga que acordarse.
--
-- Convención: una migración que reescriba datos de una tabla con trigger de eventos
-- debe desactivarlo mientras tanto (ALTER TABLE … DISABLE TRIGGER eventos_<tabla>), o
-- cada fila quedará registrada como un cambio del usuario.

-- 1. fecha_actualizacion en tareas y proyectos. Se rellena ANTES de crear los triggers.
ALTER TABLE tareas_proyectos ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP WITH TIME ZONE;
UPDATE tareas_proyectos SET fecha_actualizacion = COALESCE(fecha_terminado, fecha_creacion, CURRENT_TIMESTAMP);
ALTER TABLE tareas_proyectos
    ALTER COLUMN fecha_actualizacion SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN fecha_actualizacion SET NOT NULL;

ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP WITH TIME ZONE;
UPDATE proyectos SET fecha_actualizacion = COALESCE(fecha_terminado, fecha_creacion, CURRENT_TIMESTAMP);
ALTER TABLE proyectos
    ALTER COLUMN fecha_actualizacion SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN fecha_actualizacion SET NOT NULL;

-- 2. Tabla de eventos. proyecto_id no tiene clave foránea: la historia sobrevive al
-- registro. user_id sí: borrar un usuario borra su historia.
CREATE TABLE IF NOT EXISTS eventos (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entidad TEXT NOT NULL,
    entidad_id INT NOT NULL,
    proyecto_id INT,
    accion TEXT NOT NULL CHECK (accion IN ('creado', 'modificado', 'eliminado', 'restaurado')),
    -- {"campo": {"antes": …, "despues": …}}; texto libre: {"campo": {"modificado": true}}
    cambios JSONB NOT NULL DEFAULT '{}',
    -- 'app' por defecto; otros orígenes lo fijan con SET LOCAL cassandra.origen = '…'.
    -- 'backfill' = reconstruido desde fechas existentes (aproximado).
    origen TEXT NOT NULL DEFAULT 'app',
    ocurrido_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_eventos_user_fecha ON eventos (user_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_user_proyecto_fecha ON eventos (user_id, proyecto_id, ocurrido_en DESC)
    WHERE proyecto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eventos_entidad ON eventos (entidad, entidad_id);

-- 3. Función genérica. Argumentos del trigger: nombre de la entidad y, separados por
-- comas, los campos de texto libre (se registra que cambiaron, nunca su contenido).
CREATE OR REPLACE FUNCTION registrar_evento() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_entidad   text   := TG_ARGV[0];
    v_privados  text[] := string_to_array(COALESCE(TG_ARGV[1], ''), ',');
    v_ignorados text[] := ARRAY['id', 'user_id', 'fecha_creacion', 'fecha_actualizacion'];
    v_nuevo     jsonb  := to_jsonb(NEW);
    v_viejo     jsonb;
    v_cambios   jsonb  := '{}';
    v_accion    text;
    k           text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_accion := 'creado';
        -- Valores iniciales de los campos no privados (p. ej. el estado con que nació).
        FOR k IN SELECT jsonb_object_keys(v_nuevo) LOOP
            CONTINUE WHEN k = ANY (v_ignorados) OR k = ANY (v_privados) OR k = 'eliminado'
                OR jsonb_typeof(v_nuevo -> k) = 'null';
            v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_object('despues', v_nuevo -> k));
        END LOOP;
    ELSE
        v_viejo := to_jsonb(OLD);
        FOR k IN SELECT jsonb_object_keys(v_nuevo) LOOP
            CONTINUE WHEN k = ANY (v_ignorados) OR (v_viejo -> k) IS NOT DISTINCT FROM (v_nuevo -> k);
            IF k = ANY (v_privados) THEN
                v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_object('modificado', true));
            ELSE
                v_cambios := v_cambios || jsonb_build_object(k,
                    jsonb_build_object('antes', v_viejo -> k, 'despues', v_nuevo -> k));
            END IF;
        END LOOP;
        -- Los repositorios actualizan con COALESCE: un PUT sin cambios reales no es un evento.
        IF v_cambios = '{}' THEN
            RETURN NULL;
        END IF;
        v_accion := CASE
            WHEN v_cambios ? 'eliminado' AND COALESCE((v_nuevo ->> 'eliminado')::boolean, false) THEN 'eliminado'
            WHEN v_cambios ? 'eliminado' THEN 'restaurado'
            ELSE 'modificado'
        END;
    END IF;

    INSERT INTO eventos (user_id, entidad, entidad_id, proyecto_id, accion, cambios, origen)
    VALUES (
        (v_nuevo ->> 'user_id')::int,
        v_entidad,
        (v_nuevo ->> 'id')::int,
        CASE WHEN v_entidad = 'proyecto' THEN (v_nuevo ->> 'id')::int ELSE (v_nuevo ->> 'proyecto_id')::int END,
        v_accion,
        v_cambios,
        COALESCE(NULLIF(current_setting('cassandra.origen', true), ''), 'app')
    );
    RETURN NULL;
END;
$$;

-- 4. fecha_actualizacion de tareas y proyectos: solo cambia si cambió otra cosa.
CREATE OR REPLACE FUNCTION tocar_fecha_actualizacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW) - 'fecha_actualizacion') IS DISTINCT FROM (to_jsonb(OLD) - 'fecha_actualizacion') THEN
        NEW.fecha_actualizacion := CURRENT_TIMESTAMP;
    ELSE
        NEW.fecha_actualizacion := OLD.fecha_actualizacion;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER fecha_actualizacion_tareas_proyectos BEFORE UPDATE ON tareas_proyectos
    FOR EACH ROW EXECUTE FUNCTION tocar_fecha_actualizacion();
CREATE TRIGGER fecha_actualizacion_proyectos BEFORE UPDATE ON proyectos
    FOR EACH ROW EXECUTE FUNCTION tocar_fecha_actualizacion();

-- 5. Triggers de eventos en las tablas funcionales (no users ni refresh_tokens).
CREATE TRIGGER eventos_proyectos AFTER INSERT OR UPDATE ON proyectos
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('proyecto', 'descripcion,comentario,por_que,para_que,criterio_finalizacion');
CREATE TRIGGER eventos_tareas_proyectos AFTER INSERT OR UPDATE ON tareas_proyectos
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('tarea', 'descripcion,comentario');
CREATE TRIGGER eventos_notas_proyecto AFTER INSERT OR UPDATE ON notas_proyecto
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('nota', 'nota_proyecto');
CREATE TRIGGER eventos_documentos_proyecto AFTER INSERT OR UPDATE ON documentos_proyecto
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('documento', 'contenido');
CREATE TRIGGER eventos_project_logs AFTER INSERT OR UPDATE ON project_logs
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('log', 'contenido_raw');
CREATE TRIGGER eventos_persona AFTER INSERT OR UPDATE ON persona
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('persona', 'informacion');
CREATE TRIGGER eventos_interacciones AFTER INSERT OR UPDATE ON interacciones
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('interaccion', 'interaccion');
CREATE TRIGGER eventos_reflexiones AFTER INSERT OR UPDATE ON reflexiones
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('reflexion', 'reflexion');
CREATE TRIGGER eventos_lista_deseos AFTER INSERT OR UPDATE ON lista_deseos
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('deseo', 'justificacion');
CREATE TRIGGER eventos_banco AFTER INSERT OR UPDATE ON banco
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('banco');
CREATE TRIGGER eventos_grupo_item_finanzas AFTER INSERT OR UPDATE ON grupo_item_finanzas
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('grupo_finanzas');
CREATE TRIGGER eventos_movimiento_esperado_finanzas AFTER INSERT OR UPDATE ON movimiento_esperado_finanzas
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('movimiento_esperado');
CREATE TRIGGER eventos_finanzas_plantilla AFTER INSERT OR UPDATE ON finanzas_plantilla
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('plantilla_finanzas');
